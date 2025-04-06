chrome.runtime.onMessage.addListener((request, sender, sendResponse)=>{
    if(request.Message === "download"){
        let file_name = request.file_name;
        let url = request.url;
        let headers = request.headers;
        // 分情况下载
        if (request.is_m3u8) {
            // 实现下载 m3u8 文件的逻辑
            console.log("下载 m3u8 文件的逻辑");
        } else {      
            // 实现下载 mp4 文件的逻辑
            console.log("下载 mp4 文件的逻辑");
        }
    }
    return true;        // 异步
})