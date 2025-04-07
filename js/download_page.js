// // 将blob转换为文件
// function blob2file(blob, file_name){
//     let blob_url = URL.createObjectURL(blob);

//     chrome.downloads.download({
//         url: blob_url, // 文件URL
//         filename: file_name, // 可选，指定文件名
//         saveAs: true // 可选，是否显示"另存为"对话框
//     }, function(downloadId) {
//         console.log('Download started with ID:', downloadId);
//     });

//     URL.revokeObjectURL(blob_url); 
// }

// $("#test").on("click", function(){
//     m3u8downloader("123.mp4", "https://vip.ffzy-play5.com/20221226/4665_c65ae6f8/2000k/hls/mixed.m3u8", {});
// })


function add_task(file_name){
    // 将任务显示到页面中
    let task = $(`
    <div class="task-item">
        <div class="task-info">
            <div class="video-icon"></div>
            <span class="task-name">${file_name}</span>
        </div>
        <div class="progress-container">
            <div class="progress-bar"></div>
        </div>
        <div class="complete-container">
            <div class="complete">
                <div class="complete-img"></div>
                下载完成
            </div>
        </div>
    </div>
    `)
    // 绑定自定义事件
    task.on("download_progress", function(event, percent){
        let progress = task.find(".progress-container");
        // 设置进度
        let bar = progress.find(".progress-bar");
        let num = (percent * 100).toFixed(2);
        bar.text(num + "%");
        bar.css("width", 296 * percent);
        if(percent === 1){
            // 下载完成提示
            task.find(".complete-container").show();
        }
        console.log("当前下载进度", percent);
    });
    let task_list = $(".task-list");
    task_list.append(task);
    return task;
}

async function mp4downloader(file_name, url, headers){
    let task = add_task(file_name);
    // 创建写入流
    const file_stream = streamSaver.createWriteStream(file_name);
    const writer = file_stream.getWriter();
    let receive_length = 0;
    const res = await fetch(url, {headers: headers});
    // 得到总的数据长度
    const content_length = res.headers.get('Content-Length');
    // 以流的方式读取数据
    const reader = res.body.getReader();
    while(1){
        const {done, value} = await reader.read();
        if(done){
            break;
        }
        receive_length += value.length;
        // 保留两位小数
        let percent = Math.round(receive_length * 100 / content_length) / 100;
        task.trigger("download_progress", [percent]);
        writer.write(value);
    }
    try{
        writer.close();
    }catch(e){
        console.log(e);
    }
    
}

async function m3u8downloader(file_name, url, headers){
    let downloader = new m3u8Download(url, headers, file_name);
    let task = add_task(file_name);
    downloader.on_new_ts((total, current) => {
        task.trigger("download_progress", Math.round(current * 100 / total) / 100);
    });
    downloader.download();
}



chrome.runtime.onMessage.addListener((request, sender, sendResponse)=>{
    if(request.Message === "download"){
        let file_name = request.file_name || "download.mp4";
        let url = request.url;
        let headers = request.headers;
        // 分情况下载
        if (request.is_m3u8) {
            // 实现下载 m3u8 文件的逻辑
            console.log("下载 m3u8 文件的逻辑");
            m3u8downloader(file_name, url, headers);
            sendResponse();
        } else {      
            // 实现下载 mp4 文件的逻辑
            console.log("下载 mp4 文件的逻辑");
            mp4downloader(file_name, url, headers);
        }
    }
    return true;        // 异步
})