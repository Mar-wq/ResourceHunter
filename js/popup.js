// 展示小提示使用
function print_tip(text, delay=500){
    $('#show_tip').html(text).fadeIn(500).delay(delay).fadeOut(500);
}


function is_m3u8(data) {
    let exts = ["m3u8", "m3u"];
    let types = ["application/vnd.apple.mpegurl", "application/x-mpegurl", "application/mpegurl", "application/octet-stream-m3u8"];

    let flag = false;
    flag = exts.includes(data.ext) || types.includes(data.response_type);
    return flag;
}

// 向页面动态添加元素
function add_item(resource) {
    // 暂时不显示ts文件
    if (resource.file_name.match(/.*\.ts/)) {
        return null;
    }
    if (!resource.response_type) {
        resource.response_type = "unknow!"
    }
    let html = $(`
        <div class="item">
            <div class="item_show">
                <span class="video-icon"></span>
                <span title="${resource.file_name}">文件名: ${resource.file_name}</span>
            </div>
            <div class="item_hide">
                <div class="info">
                    MIME: ${resource.response_type}
                </div>
                <video controls>
                    Your browser does not support the video tag.
                </video>
                <button class="download">下载</button>
                
            </div>
        </div>
    `);
    // 使用闭包传递resource
    html.find(".item_show").click((function (resource) {
        return function () {
            const hide_div = $(this).parent().find(".item_hide");
            if (hide_div.is(":visible")) {
                hide_div.slideUp();
                // 隐藏时， 暂停视频
                $(this).parent().find("video")[0].pause();
            } else {
                hide_div.slideDown();
                // 删除Range头部，可以直接播放整个视频（针对m4s）
                resource.request_headers = resource.request_headers.filter(item => item.name != "Range");
                if (is_m3u8(resource)) {
                    let hls = new Hls({ enableWorker: false });
                    setRequestHeaders(resource.request_headers, () => {
                        hls.loadSource(resource.url_with_params);
                        hls.attachMedia($(this).parent().find("video")[0]);
                    })
                } else {
                    setRequestHeaders(resource.request_headers, () => {
                        $(this).parent().find("video").attr("src", resource.url_with_params);
                    });
                }
            }
        };
    })(resource))

    html.find(".download").click((function (resource) {
        return function () {
            print_tip("开始下载文件！")
            resource.request_headers = resource.request_headers.filter(item => item.name != "Range");
            let req_headers = resource.request_headers;
            let headers = {}
            for (let header of req_headers) {
                headers[header.name] = header.value;
            }
            if (is_m3u8(resource)) {
                download_resource({
                    Message: "download",
                    url: resource.url_with_params,
                    headers: headers,
                    file_name: resource.file_name,
                    is_m3u8: true
                })
            } else {
                download_resource({
                    Message: "download",
                    url: resource.url_with_params,
                    headers: headers,
                    file_name: resource.file_name,
                    is_m3u8: false
                })
            }
        }
    })(resource))


    return html;
}


// 去重, 将列表转为map, 根据url去重
function get_unique_by_url(infos) {
    if (infos instanceof Array) {
        let res = new Map();
        for (let info of infos) {
            let url = info?.url
            if (!url) {
                url = info?.request?.url;
            }
            res.set(url, info);
        }
        return res;
    }
    return null;
}

// 更新页面
let update_dom = (function () {
    let old_infos = new Map();
    return function (infos_map) {
        // console.log(infos_map);
        let $nodata = $("#nodata");
        let $resources_list = $("#resources_list")
        if (!infos_map || infos_map?.size == 0) {
            $nodata.show();
            return;
        }
        $nodata.hide();
        let add_infos = new Map();
        // 找出新增节点
        for (let [url, info] of infos_map) {
            if (!old_infos.has(url)) {
                add_infos.set(url, info);
            }
        }
        // 增加新节点
        for (let [url, info] of add_infos) {
            let node = add_item(info)
            if (node) {
                $resources_list.append(node);
            }
        }
        // 保存页面当前显示的数据
        old_infos = infos_map;
    }
})();

// 管理该页面的信息数据
class MediaInfo {
    // 提供预处理数据的函数
    constructor(prepare_data) {
        // 当前页面的id
        this.tab_id = -1;
        // 媒体的Map
        this.unique_infos = new Map();
        // 数据更新时的回调
        this.update_callbacks = []
        // 预处理得到的信息
        this.prepare_data = prepare_data;
        // 接收background劫持到的数据
        chrome.runtime.onMessage.addListener(async (request, sender, sendresponse) => {
            // sendresponse();
            let current_tab_id = await this.get_tab_id();
            if (request.Message === "popupData" && current_tab_id === request.tab_id) {
                let map = this.prepare_data(request.infos);
                if (map) {
                    for (let key of map.keys()) {
                        if (!this.unique_infos.has(key)) {
                            this.unique_infos = map;
                            for (let callback of this.update_callbacks) {
                                callback(this.unique_infos);
                            }
                            break;
                        }
                    }
                }
            }
            return false;
        })
    }

    // 获取tab_id
    async get_tab_id() {
        if (this.tab_id === -1) {
            const p = new Promise((resolve, reject) => {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (chrome.runtime.lastError) {
                        // 如果发生错误，可以通过 chrome.runtime.lastError 获取错误信息
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(tabs[0].id);
                    }
                })
            })
            this.tab_id = await p;
        }
        return this.tab_id;
    }

    on_update(callback) {
        this.update_callbacks.push(callback);
    }

    _remove(callback) {
        this.update_callbacks = this.update_callbacks.filter(item => callback != item);
    }
}






// 当前页面的媒体信息
let media_info = new MediaInfo(get_unique_by_url);
media_info.on_update(update_dom);


$("#clear").click(
    async function () {
        // 清除页面缓存的数据
        media_info.unique_infos.clear();
        // 清除页面已经展示的数据
        $("#nodata").show();
        $("#resources_list").empty();

        let tab_id = await media_info.get_tab_id();
        // 发送消息给background，让其也清除对应页面的数据
        chrome.runtime.sendMessage({ Message: "clearData", tab_id: tab_id }, function () {
            if (chrome.runtime.lastError) {
                console.log("报错位置： Popup.js/delete_resource() ", chrome.runtime.lastError.message);
            }
            return;
        })
    }
)



// 点击时，主动向background.js索要信息
document.addEventListener("DOMContentLoaded", async function () {
    let tab_id = await media_info.get_tab_id();
    chrome.runtime.sendMessage({ Message: "getPopupData", tab_id: tab_id }, function (infos) {
        if (chrome.runtime.lastError) {
            console.log("报错位置： Popup.js", chrome.runtime.lastError.message);
        }
        let infos_map = get_unique_by_url(infos);
        update_dom(infos_map);
        return true;
    })
})


// 当popup页面不见的时候需要向background报告
document.addEventListener("visibilitychange", async function () {
    // console.log("即将关闭");
    // let tab_id = await media_info.get_tab_id();
    // chrome.runtime.sendMessage({ Message: "closePopup", tab_id: tab_id });
})


// 发送消息到下载页面
function download_resource(message){
    const targetUrl = chrome.runtime.getURL("download_page.html");
    // 如果没有下载页面，创建一个
    chrome.tabs.query({url: targetUrl}, function(tabs) {
        if(tabs.length <= 0){
            // 如果没有找到，创建一个新的下载页面, 异步操作
            chrome.tabs.create({url: targetUrl, active: false}, function(tab) {
                let download_tabId = tab.id;
                console.log("New download page created.");
                // 如果页面未加载完成，则监听加载完成事件, 然后发送数据
                const listener = (updatedTabId, changeInfo) => {
                    if (updatedTabId === download_tabId && changeInfo.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        chrome.tabs.sendMessage(download_tabId, message, function(response) {
                            if(chrome.runtime.lastError){
                                console.log(chrome.runtime.lastError);
                            }
                            console.log("Message sent to download page");
                        });
                    }
                };
                chrome.tabs.onUpdated.addListener(listener);
            });
        }else{
            // 如果找到了，获取第一个匹配的tab
            let download_tabId = tabs[0].id;
            // 发送消息给存在的下载页面
            chrome.tabs.sendMessage(download_tabId, message, function(response) {
                if(chrome.runtime.lastError){
                    console.log(chrome.runtime.lastError);
                }
                console.log("Message sent to existing download page");
            });
        }
    });
}








