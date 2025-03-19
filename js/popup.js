
// 向页面动态添加元素
function add_item(resource) {
    let html = $(`
        <div class="item">
            <div class="item_show">
                <span class="video-icon"></span>
                文件名：${resource.file_name} 
            </div>
            <div class="item_hide">
                <div>
                    MIME：${resource.response_type}
                </div>
                <video controls>
                    Your browser does not support the video tag.
                </video>
            </div>
        </div>
    `);
    // 使用闭包传递resource
    html.click((function (resource) {
        return function () {
            const hide_div = $(this).find(".item_hide");
            if (hide_div.is(":visible")) {
                hide_div.slideUp();
                // 隐藏时， 暂停视频
                $(this).find("video")[0].pause();
                $(this).css("margin-bottom", "10px");

            } else {
                hide_div.slideDown();
                $(this).css("margin-bottom", hide_div.outerHeight() + "px");
                // 删除Range头部，可以直接播放整个视频（针对m4s）
                resource.request_headers = resource.request_headers.filter(item => item.name != "Range");
                setRequestHeaders(resource.request_headers, () => {
                    $(this).find("video").attr("src", resource.url_with_params);
                });
            }
        };
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
function update_dom(infos_map) {
    // console.log(infos_map);
    let $nodata = $("#nodata");
    let $resources_list = $("#resources_list")
    if (!infos_map || infos_map?.size == 0) {
        $nodata.show();
        return;
    }
    $nodata.hide();
    $resources_list.empty();
    for (let [url, info] of infos_map) {
        let node = add_item(info)
        $resources_list.append(node);
    }
}

// 管理该页面的信息数据
class MediaInfo {
    constructor() {
        // 当前页面的id
        this.tab_id = -1;
        // 媒体的Map
        this.unique_infos = new Map();
        // 数据更新时的回调
        this.update_callbacks = []

        // 接收background劫持到的数据
        chrome.runtime.onMessage.addListener(async (request, sender, sendresponse) => {
            sendresponse();
            let current_tab_id = await this.get_tab_id();
            if (request.Message === "popupData" && current_tab_id === request.tab_id) {
                let map = get_unique_by_url(request.infos);
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
let media_info = new MediaInfo();
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









