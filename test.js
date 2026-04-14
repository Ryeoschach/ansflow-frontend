const deepClone = (obj) => {
    if (typeof obj !== 'object' || obj == null) return obj;
    let result = Array.isArray(obj) ? [] : {};
    for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
            result[key] = deepClone(obj[key]);
        }
    }
    return result;
}

const deepClone1 = (obj, map = new WeakMap()) => {
    // 1. 基本类型直接返回
    if (typeof obj !== 'object' || obj == null) return obj;

    // 2. 检查是否已经拷贝过（解决循环引用）
    if (map.has(obj)) {
        return map.get(obj); // 如果拷贝过，直接返回之前的引用
    }

    // 3. 初始化结果（兼容数组和对象）
    let result = Array.isArray(obj) ? [] : {};

    // 4. 将当前对象存入 Map
    map.set(obj, result);

    // 5. 递归拷贝
    for (let key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            result[key] = deepClone1(obj[key], map); // 传递 map
        }
    }
    return result;
}

// const a = {k1: {k2: "aa"}}
const a = {k1: "aa"}
console.log(deepClone(a))