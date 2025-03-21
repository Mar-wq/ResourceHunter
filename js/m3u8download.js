// // 加载 ASE 解密
// let $ase = document.createElement('script')
// $ase.src = 'https://upyun.luckly-mjw.cn/lib/aes-decryptor.js'

// // // 加载 mp4 转码
// let $mp4 = document.createElement('script')
// $mp4.src = 'https://upyun.luckly-mjw.cn/lib/mux-mp4.js'

// // 加载 stream 流式下载器
// let $streamSaver = document.createElement('script')
// $streamSaver.src = 'https://upyun.luckly-mjw.cn/lib/stream-saver.js'

class M3u8Download{
    constructor(headers, file_name, mask_task=6){
        this.aes_conf = {};
        this.ts_list = [];
        this.finish_list = [];
        this.duration_time = 0;
        this.headers = {headers: headers};
        this.fail_cnt = [];
        this.finish_cnt = 0;
        this.file_name = file_name;
        this.media_file = [];
        this.max_tasks = mask_task;
        // this.transmuxer = {};
    }

    download_file(fileDataList, filename) {
        let fileBlob = null
        let a = document.createElement('a')
        fileBlob = new Blob(fileDataList, { type: 'video/mp4' }) // 创建一个Blob对象，并设置文件的 MIME 类型
        a.download = filename 
        a.href = URL.createObjectURL(fileBlob)
        a.click()
        URL.revokeObjectURL(a.href)
    }

    aes_decrypt(data, index) {
        let iv = this.aes_conf.iv || new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, index])
        return this.aes_conf.decryptor.decrypt(data, 0, iv.buffer || iv, true)
      }

    // 合成URL
    merge_url(targetURL, baseURL) {
        baseURL = baseURL || location.href
        if (targetURL.indexOf('http') === 0) {
            // 当前页面使用 https 协议时，强制使 ts 资源也使用 https 协议获取
            if(location.href.indexOf('https') === 0){
                return targetURL.replace('http://','https://')
            }
            return targetURL
        } else if (targetURL[0] === '/') {
            let domain = baseURL.split('/')
            return domain[0] + '//' + domain[2] + targetURL
        } else {
            let domain = baseURL.split('/')
            domain.pop()
            return domain.join('/') + '/' + targetURL
        }
    }
    // 解密ts文件，同时做转码处理
    handle_ts(file, index){
        const data = this.aes_conf.uri ? this.aes_decrypt(file, index) : file;
        this.to_mp4(data, index, (segment, idx) => {
            let data = null;
            // 第一个ts文件，保留mp4的头部
            if(idx == 0){
                data = new Uint8Array(segment.initSegment.byteLength + segment.data.byteLength);
                data.set(segment.initSegment, 0);
                data.set(segment.data, segment.initSegment.byteLength);
            }
            else{
                // 其他ts不需要头部
                data = segment.data;
            }
            this.media_file[idx] = data;
            this.finish_cnt += 1;
            this.finish_list[idx].status = "finish";
            if(this.finish_cnt === this.ts_list.length){
                this.download_file(this.media_file, this.file_name);
                console.log("保存到电脑");
                // debugger;
            }
        })
        console.log(`已完成${this.finish_cnt}个下载`);
        console.log(`文件总数${this.ts_list.length}, 文件${index}下载完成`);

    }

    to_mp4(data, index, callback){
        // 每次创建新的转换对象 
        let transmuxer = new muxjs.Transmuxer({
            keepOriginalTimestamps: true,
            duration: parseInt(this.duration_time),
        });
        transmuxer.on('data', segment => {
            callback(segment, index)
        })

        transmuxer.push(new Uint8Array(data));
        transmuxer.flush();
    }

    download_ts(){
        console.log("ts下载进行中...");
        let dowmload = (index, max_fail_cnt=5)=>{
            // 当前文件没有下载完成 或者 没有正在下载
            if(this.finish_list[index] && (this.finish_list[index].status != 'finish' && this.finish_list[index].status != 'downloading')){
                this.finish_list[index].status = "downloading";
                fetch(this.ts_list[index], this.headers).then(res=>res.arrayBuffer())
                .then((file)=>{
                    this.handle_ts(file, index)

                    // 找到一个没下载的文件
                    index += 1;
                    while(index < this.ts_list.length 
                        && (this.finish_list[index].status == 'finish' || this.finish_list[index].status == 'downloading')){
                        index += 1;
                    }
                    // index处文件下载完成， 还有未下载的ts文件
                    if(index < this.ts_list.length){
                        dowmload(index);
                    }
                    
                })
                .catch(err => {
                    this.finish_list[index].status = "error";
                    console.log(`第${index}个ts下载错误`, err);
                    this.fail_cnt[index] += 1;
                    if(this.fail_cnt[index] < max_fail_cnt){
                        // 尝试重新下载
                        console.log(`重新下载第${index}个文件`);
                        dowmload(index);
                    }else{
                        console.log("下载达到最大次数");
                    }
                });
            }
        }
        for(let i = 0; i < Math.min(this.max_tasks, this.ts_list.length); i++){
            dowmload(i);
        }
    }

    get_aes() {
        // alert('视频被 AES 加密，点击确认，进行视频解码')
        fetch(this.aes_conf.uri, this.headers).then(res => res.arrayBuffer())
        .then((key)=>{
            this.aes_conf.key = key
            this.aes_conf.decryptor = new AESDecryptor()
            this.aes_conf.decryptor.constructor()
            this.aes_conf.decryptor.expandKey(aes_conf.key);
            this.download_ts();
        }).catch((err)=>console.log("视频解密失败"))
    }

    get_m3u8(url){
        // 记录标题
        // const title = new URL(url).searchParams.get("title") || "m3u8";
        // 记录下载开始时间
        // const start_time = new Date();

        console.log("开始下载m3u8文件");
        // https://json.vidz.asia/Vtche/BF/553830194.m3u8
        fetch(url, this.headers).then(res=>res.text())
        .then((m3u8)=>{
            let lines = m3u8.split("\n");
            // 得到下载列表
            for(let line of lines){
                // url都是以非 # 开头
                if(/^[^#]/.test(line)){
                    console.log("ts地址: ", line);
                    this.ts_list.push(this.merge_url(line, url));
                    this.finish_list.push({
                        title: line,
                        status: ""
                    })
                    this.fail_cnt.push(0);
                }
            }
            // 得到视频时长
            for(let line of lines){
                if(line.toUpperCase().indexOf("#EXTINF:") > -1){
                    this.duration_time += parseFloat(line.split('#EXTINF:')[1]);
                }
            }
            console.log("总时长： ", this.duration_time);



            // 文件加密了
            if (m3u8.indexOf('#EXT-X-KEY') > -1){
                this.aes_conf.method = (m3u8Str.match(/(.*METHOD=([^,\s]+))/) || ['', '', ''])[2]
                this.aes_conf.uri = (m3u8Str.match(/(.*URI="([^"]+))"/) || ['', '', ''])[2]
                this.aes_conf.iv = (m3u8Str.match(/(.*IV=([^,\s]+))/) || ['', '', ''])[2]
                this.aes_conf.iv = this.aesConf.iv ? this.aesConf.stringToBuffer(this.aesConf.iv) : ''
                this.aes_conf.uri = this.merge_url(aes_conf.uri, url);
                this.get_aes();
            }else{
                this.download_ts();
            }

        }).catch((err) => console.log("文件下载失败", err))
    }

}

// let test = new M3u8Download({},"test.mp4");
// test.get_m3u8("https://vip.ffzy-play5.com/20221226/4665_c65ae6f8/2000k/hls/mixed.m3u8");