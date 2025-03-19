// 用来设置请求头的
function setRequestHeaders(data = {}, callback = undefined) {
    // 确保使用正确的API
    chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [1] });

    // 使用 chrome.tabs.query 获取当前活动的标签页
    chrome.tabs.getCurrent(function (tabs) {
        const rules = { removeRuleIds: [tabs ? tabs.id : 1] };

        if (data.length > 0) {
            const requestHeaders = data.map(obj => ({ header: obj.name, operation: "set", value: obj.value }));
            rules.addRules = [{
                id: tabs ? tabs.id : 1,
                priority: tabs ? tabs.id : 1,
                action: {
                    type: "modifyHeaders",
                    requestHeaders: requestHeaders
                },
                condition: {
                    resourceTypes: ["xmlhttprequest", "media", "image"],
                }
            }];

            if (tabs) {
                rules.addRules[0].condition.tabIds = [tabs.id];
            } else {
                rules.addRules[0].condition.initiatorDomains = [chrome.runtime.id];
            }
        }

        // 更新动态规则
        chrome.declarativeNetRequest.updateDynamicRules(rules, function () {
            if (chrome.runtime.lastError) {
                console.error('Error updating dynamic rules:', chrome.runtime.lastError);
            } else {
                console.log('Dynamic rules updated successfully.');
            }
            callback && callback();
        });
    });
}