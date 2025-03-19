// 一个循环队列的实现
class CircularQueue {
    constructor(size) {
        this.queue = new Array(size);
        this.head = 0;
        this.tail = 0;
        this.maxSize = size;
        this.currentSize = 0;
    }

    // 添加元素到队列
    enqueue(element) {
        if (this.isFull()) {
            console.log("Queue is full");
            return false;
        }
        this.queue[this.tail] = element;
        this.tail = (this.tail + 1) % this.maxSize;
        this.currentSize += 1;
        return true;
    }

    // 从队列移除元素
    dequeue() {
        if (this.isEmpty()) {
            console.log("Queue is empty");
            return null;
        }
        let item = this.queue[this.head];
        this.head = (this.head + 1) % this.maxSize;
        this.currentSize -= 1;
        return item;
    }

    // 检查队列是否为空
    isEmpty() {
        return this.currentSize === 0;
    }

    // 检查队列是否已满
    isFull() {
        return this.currentSize === this.maxSize;
    }

    // 获取当前队列大小
    size() {
        return this.currentSize;
    }

    // 打印队列内容
    content() {
        let result = [];
        for (let i = 0; i < this.currentSize; i++) {
            result.push(this.queue[(this.head + i) % this.maxSize]);
        }
        return result;
    }
}