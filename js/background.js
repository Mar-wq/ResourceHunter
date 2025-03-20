importScripts("/js/handle_resource.js")
// 发消息给popup页面
function hook_callback(tmp, tab_id) {
    if (tmp) {
        chrome.runtime.sendMessage({
            Message: "popupData",
            tab_id: tab_id,
            infos: tmp.content()
        }, () => {
            if (chrome.runtime.lastError) {
                // popup.js 未加载时，打印信息
                console.log("报错位置： background.js", chrome.runtime.lastError.message);
            }
        })
    }
}


// hook专注于抓取数据，以及数据改变时，帮助回调
class ChromeHook {
    constructor(finder, filter) {
        // 记录请求头与请求id, 方便到时候找到请求头与响应
        this.reqid_map = new Map();
        // 用来添加资源
        this._finder = finder;
        // 用来过滤资源
        this._filter = filter;
        this.callbacks = [];

        // hook请求
        chrome.webRequest.onBeforeRequest.addListener(
            (data) => {
                try {
                    // 过滤不需要的数据包
                    if (this._filter.resource_filter(data)) {
                        return;
                    }
                    // 获得数据包的请求id, 将其记录到Map中，当收到响应的时候能够得到请求头等信息
                    const reqid = data.requestId;
                    this.reqid_map.set(reqid, data);
                } catch (e) { console.log(e); }
            }, { urls: ["<all_urls>"] }, ["requestBody"]
        );


        chrome.webRequest.onSendHeaders.addListener((data) => {
            try {
                // 过滤不需要的数据包
                if (this._filter.resource_filter(data)) {
                    return;
                }
                // 获得数据包的请求id, 将其记录到Map中，当收到响应的时候能够得到请求头等信息
                const reqid = data.requestId;
                this.reqid_map.set(reqid, data);
            } catch (e) { console.log(e); }

        }, { urls: ["<all_urls>"] }, ["requestHeaders", "extraHeaders"])

        // hook响应
        chrome.webRequest.onResponseStarted.addListener((data) => {
            try {
                // console.log("收到响应");
                // 收到响应时，记录了请求ID，未记请求的暂时删除
                if (this.reqid_map.has(data.requestId)) {
                    // console.log("请求头", reqid_map.get(data.requestId));
                    // 需要的数据将其加入资源
                    let request = this.reqid_map.get(data.requestId);
                    this._finder.add_resource(request, data);
                    if (this._finder.is_status_change()) {
                        // 数据改变了
                        let tmp = this._finder.resource.get(request.tabId, null);
                        for (let fun of this.callbacks) {
                            fun(tmp, request.tabId);
                        }
                    }
                    this.reqid_map.delete(data.requestId);
                }
            } catch (e) { console.log(e); }

            // console.log("响应数据", data);
        }, { urls: ["<all_urls>"] }, ["responseHeaders"])

        // 删除失败的requestHeadersData
        chrome.webRequest.onErrorOccurred.addListener(
            (data) => {
                if (this.reqid_map.has(data.requestId)) {
                    this.reqid_map.delete(data.requestId);
                }
            }, { urls: ["<all_urls>"] }
        );
    }
    // 抓到新数据的时候调用
    on_hook(callback) {
        this.callbacks.push(callback);
    }
    remove_callback(callback) {
        this.callbacks = this.callbacks.filter(item => item != callback);
    }
}


let chromehook = new ChromeHook(__finder, __filter);
chromehook.on_hook(hook_callback);


// 页面主动请求时，返回数据
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.Message == "getPopupData") {
        if (chromehook._finder.resource.has(request.tab_id)) {
            tmp = chromehook._finder.resource.get(request.tab_id).content();
            sendResponse(chromehook._finder.resource.get(request.tab_id).content());
        }
        // 返回给sendMessage的页面， 防止报错
        return true;
    }
    // popup被关闭时的处理
    else if (request.Message == "closePopup") {
        return;
    }
    // 清除当前监听的缓存数据
    else if (request.Message === "clearData") {
        if (chromehook._finder.resource.has(request.tab_id)) {
            chromehook._finder.resource.delete(request.tab_id);
        }
        // 返回给sendMessage的页面， 防止报错
        return true;
    }
})