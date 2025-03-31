// importScripts("/lib/aes-decryptor.js", "/lib/mux-mp4.js", "/lib/stream-saver.js")


// 提供各种资源的下载方法
class m3u8Download {
    constructor(m3u8_url, headers, file_name) {
        this.m3u8_url = m3u8_url;
        this.headers = headers;
        this.ts_list = [];
        this.ts_cnt = 0;
        this.finish_cnt = 0;
        this.duration_time = 0;
        this.aes_conf = {};
        this.mp4_list = [];
        // 下载完成后的资源接口
        this.blob = null;

        // 未来考虑支持流式下载， 目前没实现
        // this.stream_writer = null;
        // this.stream_idx = 0;
    }
    // 合成网址
    merge_url(targetURL, baseURL) {
        baseURL = baseURL || location.href
        if (targetURL.indexOf('http') === 0) {
            // 当前页面使用 https 协议时，强制使 ts 资源也使用 https 协议获取
            if (location.href.indexOf('https') === 0) {
                return targetURL.replace('http://', 'https://')
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
    // 带请求头的发送
    fetch_with_headers(url) {
        return fetch(url, { headers: this.headers });
    }

    async get_media_infos() {
        await this.fetch_with_headers(this.m3u8_url).then(res => res.text())
            .then((m3u8) => {
                let lines = m3u8.split("\n");
                for (let line of lines) {
                    // url都是以非 # 开头
                    if (/^[^#]/.test(line)) {
                        console.log("ts地址: ", line);
                        this.ts_list.push({
                            url: this.merge_url(line, this.m3u8_url),
                            // 0 未开始下载， 1下载中， 2下载完成， 3下载错误
                            status: 0
                        });
                    }
                }
                // 得到视频时长
                for (let line of lines) {
                    if (line.toUpperCase().indexOf("#EXTINF:") > -1) {
                        this.duration_time += parseFloat(line.split('#EXTINF:')[1]);
                    }
                }
                this.ts_cnt = this.ts_list.length;
                // 如果文件加密， 记录信息
                if (m3u8.indexOf('#EXT-X-KEY') > -1) {
                    this.aes_conf.method = (m3u8.match(/(.*METHOD=([^,\s]+))/) || ['', '', ''])[2]
                    this.aes_conf.uri = (m3u8.match(/(.*URI="([^"]+))"/) || ['', '', ''])[2]
                    this.aes_conf.iv = (m3u8.match(/(.*IV=([^,\s]+))/) || ['', '', ''])[2]
                    this.aes_conf.iv = this.aes_conf.iv ? new TextEncoder().encode(this.aes_conf.iv) : ''
                    this.aes_conf.uri = this.merge_url(this.aes_conf.uri, url);
                    this.fetch_with_headers(this.aes_conf.uri).then(res => res.arrayBuffer())
                        .then((key) => {
                            this.aes_conf.key = key
                            this.aes_conf.decryptor = new AESDecryptor()
                            this.aes_conf.decryptor.constructor()
                            this.aes_conf.decryptor.expandKey(this.aes_conf.key);
                        }).catch((err) => {
                            console.log("视频解密信息获取失败", err);
                        });
                }
            }).catch((err) => {
                console.log("get_media_infos fails!", err);
            });
    }


    // 发起多个异步请求, num 异步请求数量
    async download_ts(num) {
        // 解密
        let aes_decrypt = (data, index) => {
            let iv = this.aes_conf.iv || new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, index])
            return this.aes_conf.decryptor.decrypt(data, 0, iv.buffer || iv, true)
        }
        let ts2mp4 = (ts, index) => {
            const data = this.aes_conf.uri ? aes_decrypt(ts, index) : ts;

            let transmuxer = new muxjs.Transmuxer({
                keepOriginalTimestamps: true,
                duration: parseInt(this.duration_time),
            });
            transmuxer.on('data', segment => {
                let mp4_data = null;
                // mp4头部的数据不能丢
                if (index == 0) {
                    mp4_data = new Uint8Array(segment.initSegment.byteLength + segment.data.byteLength);
                    mp4_data.set(segment.initSegment, 0);
                    mp4_data.set(segment.data, segment.initSegment.byteLength);
                } else {
                    mp4_data = segment.data;
                }
                this.mp4_list[index] = mp4_data;
                this.finish_cnt += 1;
                // 修改状态为完成
                this.ts_list[index].status = 2;

                // 打印进度
                console.log(`ts总数${this.ts_cnt}, 当前完成${this, this.finish_cnt}`);

                // 下载完成后的操作
                if (this.finish_cnt == this.ts_cnt) {
                    this.blob = new Blob(this.mp4_list, { type: "video/mp4" });
                }
            })

            transmuxer.push(new Uint8Array(data));
            transmuxer.flush();
        }
        let helper = (index) => {
            // 没有下载或则下载失败时， 才进行下载
            if (index < this.ts_list.length) {
                // 没开始下载， 或者下载失败
                if ((this.ts_list[index].status == 0) || this.ts_list[index].status == 4) {
                    // 状态更改为： 下载中
                    this.ts_list[index].status = 1;
                    this.fetch_with_headers(this.ts_list[index].url).then(res => res.arrayBuffer())
                        .then((ts) => {
                            ts2mp4(ts, index);
                            helper(index + 1);   //下载完成后，开启下载下一个片段
                        }).catch(err => {
                            console.log("download helper failed!", err);
                        })
                } else {
                    // 已经下载成功或则正在下载， 开启下一个下载
                    helper(index + 1);
                }
            }
        }
        // 开启num个异步任务
        for (let i = 0; i < Math.min(num, this.ts_cnt); i++) {
            console.log("异步任务开启", i);
            helper(i);
        }

    }

    async download() {
        // 获得m3u8文件的基本信息
        await this.get_media_infos();

        // 创建一个流（未来实现）
        // const file_stream = await createFileStream(filename);
        // this.stream_writer = file_stream.

        console.log("下载开始");
        await this.download_ts(6, this.callback);
        return this.blob;
    }

}



// let test = new m3u8Download("https://vip.ffzy-play5.com/20221226/4665_c65ae6f8/2000k/hls/mixed.m3u8", {}, "123.mp4");
// test.download();



// 监听popup页面的下载请求
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//     if (request.Message === "download") {
//         let file_name = request.file_name;
//         let url = request.url;
//         let headers = request.headers;
//         // 下载m3u8文件
//         if (request.is_m3u8) {
//             let m3u8_down = new m3u8Download(url, headers, file_name);
//             m3u8_down.download().then((blob) => {
//                 // 将数据发送到content.js
//             })
//         } else {      // mp4文件 
//            // 将数据发送到content.js
//         }
//         return true;
//     }
// })

// // background.js
// chrome.runtime.onMessage.addListener(async (request) => {
//     if (request.action === "saveProcessedFile") {
//       // 1. 获取原始数据
//       const response = await fetch(request.url);
//       const data = await response.arrayBuffer();
  
//       // 2. 处理数据
//       const processedData = decryptData(data, request.key);
  
//       // 3. 保存到本地文件
//       chrome.fileSystem.chooseEntry({
//         type: 'saveFile',
//         suggestedName: 'processed-file.mp4'
//       }, (entry) => {
//         entry.createWriter((writer) => {
//           writer.write(new Blob([processedData]));
//         });
//       });
//     }
//   });


// console.log("下载脚本");


//下载文件
// chrome.fileSystem.chooseEntry({
//     type: 'saveFile',
//     suggestedName: 'binary-data.bin'
//   }, (fileEntry) => {
//     fileEntry.createWriter((fileWriter) => {
//       // 创建一个 Uint8Array 数据（示例：ASCII码 "Hello"）
//       const uint8Array = new Uint8Array([72, 101, 108, 108, 111]);
      
//       // 直接写入 Uint8Array
//       fileWriter.write(uint8Array);
  
//       fileWriter.onwriteend = () => {
//         console.log("Uint8Array 写入完成！");
//       };
//       fileWriter.onerror = (e) => {
//         console.error("写入失败:", e);
//       };
//     });
//   });