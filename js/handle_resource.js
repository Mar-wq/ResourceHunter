// 该文件夹用于添加过滤函数，增加资源的函数等，后续bg.js会将其注册进入回调
importScripts("/js/util.js")

// 专注于抓取需要的数据， 如还需抓取其他数据，需要用户自己提供回调
class ResourceFinder {
    constructor(req_rules=[], res_rules=[]) {
        let base_req_rules = [
            { "ext": "flv", "size": 0, "state": true },
            { "ext": "hlv", "size": 0, "state": true },
            { "ext": "f4v", "size": 0, "state": true },
            { "ext": "mp4", "size": 0, "state": true },
            { "ext": "mp3", "size": 0, "state": true },
            { "ext": "wma", "size": 0, "state": true },
            { "ext": "wav", "size": 0, "state": true },
            { "ext": "m4a", "size": 0, "state": true },
            { "ext": "ts", "size": 0, "state": false },
            { "ext": "webm", "size": 0, "state": true },
            { "ext": "ogg", "size": 0, "state": true },
            { "ext": "ogv", "size": 0, "state": true },
            { "ext": "acc", "size": 0, "state": true },
            { "ext": "mov", "size": 0, "state": true },
            { "ext": "mkv", "size": 0, "state": true },
            { "ext": "m4s", "size": 0, "state": true },
            { "ext": "m3u8", "size": 0, "state": true },
            { "ext": "m3u", "size": 0, "state": true },
            { "ext": "mpeg", "size": 0, "state": true },
            { "ext": "avi", "size": 0, "state": true },
            { "ext": "wmv", "size": 0, "state": true },
            { "ext": "asf", "size": 0, "state": true },
            { "ext": "movie", "size": 0, "state": true },
            { "ext": "divx", "size": 0, "state": true },
            { "ext": "mpeg4", "size": 0, "state": true },
            { "ext": "vid", "size": 0, "state": true },
            { "ext": "aac", "size": 0, "state": true },
            { "ext": "mpd", "size": 0, "state": true },
        ]
        let base_res_rules = [
            { "type": "audio/.*", "size": 0, "state": true },
            { "type": "video/.*", "size": 0, "state": true },
            { "type": "application/ogg", "size": 0, "state": true },
            { "type": "application/vnd.apple.mpegurl", "size": 0, "state": true },
            { "type": "application/x-mpegurl", "size": 0, "state": true },
            { "type": "application/mpegurl", "size": 0, "state": true },
            { "type": "application/octet-stream-m3u8", "size": 0, "state": true },
            { "type": "application/dash+xml", "size": 0, "state": true },
            { "type": "application/m4s", "size": 0, "state": true }
        ]
        this.config = {
            request_rules: [
                ...base_req_rules,
                ...req_rules
            ],
            response_rules: [
                ...base_res_rules,
                ...res_rules
            ]
        };
        // 这里面的函数负责将需要的资源加入对应的列表
        this.resource_callbacks = [this.add_media];
        // 资源存储在此处
        this.resource = new Map();
    }
    // 该函数用来嗅探视频和音频资源
    add_media(request, response) {
        // 根据请求头查找，查看我们的配置是否保留该资源, 此处是根据后缀,正则表达式有点复杂（个人喜好）
        let reg = /(?<url>https?:\/\/(.*?)\/(?<file_name>[^\/]*?(\.(?<ext>([^\/]*?)))?))(?<params>\?.*|$)/;
        let result = reg.exec(request.url) || [];
        let res = {}
        if (result.length) {
            res.url = result.groups.url;
            res.file_name = result.groups.file_name;
            res.ext = result.groups.ext;
            res.params = result.groups.params;
        }
        let flag = false;
        if(res.ext){
            for (let dic of this.config.request_rules) {
                if (dic.state && dic.ext == res.ext) {
                    flag = true;
                    break;
                }
            }
        }
        // 根据响应查找
        let res_headers = response.responseHeaders || [];
        for (let header of res_headers) {
            if(header.name === "content-type"){
                for (let type_dic of this.config.response_rules) {
                    if (type_dic.state && header.value.match(new RegExp(type_dic.type))) {
                        // 响应同时符合要求
                        res.response_type = type_dic.type;
                        flag = true;
                        break;
                    }
                }
            } 
        }
        // 根据响应获取文件大小
        for(let header of res_headers){
            if(header.name === "content-length"){
                res.file_size = parseInt(header.value);
                break;
            }else if(header.name === "content-range"){
                let size = header.value.split('/')[1];
                if (size !== '*') {
                    res.file_size = parseInt(size);
                    break;
                }
            }
        }

        // 如果只有请求符合要求，也需要返回
        if (flag) {
            return res;
        }
        // 都不符合要求
        return null;
    }

    // 注册添加资源的回调函数， 需要添加某个资源的时候，需要注册到此处
    regester_callback(callback) {
        this.resource_callbacks.push(callback);
        return;
    }

    unregester_callback(callback) {
        this.resource_callbacks = this.regester_resourse_callback.filter(fun => fun != callback);
        return;
    }

    // 保存资源
    add_resource(request, response) {
        for (let callback of this.resource_callbacks) {
            let res = callback.call(this, request, response);
            if (res) {
                console.log(request.url);
                if (this.resource.has(request.tabId)) {
                    let tab_list = this.resource.get(request.tabId);
                    if (tab_list.isFull()) {
                        tab_list.dequeue();
                    }
                    tab_list.enqueue({
                        tab_id: request.tabId,
                        url_with_params: request.url,
                        request_headers: request.requestHeaders,
                        ...res
                    })
                } else {
                    this.resource.set(request.tabId, new CircularQueue(500));
                }
            }
        }
    }
}


// 专注于过滤不要的数据， 如需过滤其他数据，需要用户自己提供回调
class ResourceFilter {
    constructor(reg_list=[]) {
        // 用来使用用户正则表达式的
        this.reg_list = [/chrome-extension:.*/, ...reg_list];
        this.filter_callbacks = [this.filter_by_initiator];
    }
    // 删除不需要监听的请求, true不需要监听， false需要继续监听
    filter_by_initiator(data) {
        if (data.initiator != "null" && data.initiator != undefined) {
            for (let reg of this.reg_list) {
                if (reg.test(data.initiator)) {
                    return true;
                }
            }

        }
        return false;
    }
    // 注册添加资源的回调函数， 不要某些资源的时候，可以注册到此处
    regester_callback(callback) {
        this.filter_callbacks.push(callback);
        return;
    }

    unregester_callback(callback) {
        this.filter_callbacks = this.filter_callbacks.filter(fun => fun != callback);
        return;
    }

    // 返回true表示需要过滤，即不监听此请求
    resource_filter(data) {
        for (let filter of this.filter_callbacks) {
            if (filter.call(this, data)) {
                return true;
            }
        }
        return false;
    }

}
