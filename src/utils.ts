const STORAGE_NAME = "SansFinacialCore"



function dateToTimestamp(dateStr) {
    // 使用正则表达式检查日期时间格式，并添加缺少的前导零
    const dateTimeRegex = /(\d{4})\|(\d{1,2})\|(\d{1,2})\|(\d{1,2})\|(\d{1,2})\|(\d{1,2})/;
    const paddedDateStr = dateStr.replace(dateTimeRegex, (match, year, month, day, hour, minute, second) => {
        month = month.padStart(2, '0');
        day = day.padStart(2, '0');
        hour = hour.padStart(2, '0');
        minute = minute.padStart(2, '0');
        second = second.padStart(2, '0');
        return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    });

    // 解析日期时间字符串并转换为时间戳
    const date = new Date(paddedDateStr);
    return date.getTime(); // 返回时间戳
}

function timestampToDateExactFormat(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function splitArrayIntoChunks<T>(array: T[], chunkSize: number): T[][] {
    let chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        let chunk = array.slice(i, i + chunkSize);
        chunks.push(chunk);
    }
    return chunks;
}

function isValidJSON(str: string): boolean {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
}

class Shop {
    //商店
    id: string;
    name: string;
    intro: string; //商店的广告介绍
    description: string; //商店的全部介绍
    ownerId: string; //商店的拥有者
    createTime: number; //商店的创建时间，timestamp
    commodityKinds: number; //商品种类
    commodityCount: number; //商品数量
    commoditySold: number; //累计卖出数量
    turnoverSum: Array<{ currencyId: string, amount: number }>; //累计营业额
    sellShelf: Array<{ property: Property, price: { currencyId: string, amount: number }, amount: number }>; //在售物品货架
    purchaseShelf: Array<{ property: Property, price: { currencyId: string, amount: number }, amount: number }>; //收购物品货架

    constructor(name: string, intro: string, description: string, ownerId: string) {
        this.id = name;
        this.name = name;
        this.intro = intro;
        this.description = description;
        this.ownerId = ownerId;
        this.createTime = Date.now();
        this.commodityKinds = 0;
        this.commodityCount = 0;
        this.commoditySold = 0;
        this.turnoverSum = [];
        this.sellShelf = [];
    }

    /**
     * 尝试从商店买
     * @param propertyName 商品的名称
     * @param receiverId 买家的玩家ID
     * @param buyAmount 购买的数量
     * @returns [1:货币不足|0:正常返回|-1:购买数量不合法]
     */
    tryBuy(propertyName: string, buyAmount: number, receiverId: string): number {
        buyAmount = Math.floor(buyAmount);
        if (buyAmount < 1) {
            return -1;
        }

        let fData = FinancialManager.__instance.__getStorage({ playerId: receiverId });
        let currencyArr: Array<{ currency: Currency, amount: number }> = fData[receiverId]['currency'];
        //在收购货架找到指定名字的货物收购信息
        let propertyProps = this.sellShelf.filter((e) => e.property.id === propertyName)[0];
        if (buyAmount > propertyProps.amount) {
            buyAmount = propertyProps.amount;
        }

        let price = propertyProps.price;
        //找到价格中对应的currency:Currency对象
        let currencyPrice = currencyArr.filter((e) => e.currency.id === propertyProps.price.currencyId)[0].currency;

        //找到需要的货币并比较决定是否售出
        let index = currencyArr.findIndex((e) => e.currency.bindId === currencyPrice.bindId);
        if (index === -1) {
            return 1; //没有在买家的钱袋里找到指定的货币
        }
        if (fData[receiverId]['currency'][index].amount < price.amount * buyAmount) {
            //钱币不太够
            return 1;
        }

        //给买家交易货物和资产
        FinancialManager.__instance.addBill(
            receiverId,
            {
                currency: [
                    { currency: currencyPrice, amount: -(price.amount * buyAmount) }
                ],
                property: [
                    { property: propertyProps.property, amount: buyAmount }
                ],
                receiverId: receiverId,
                payerId: this.ownerId,
                reason: `从商店 ${this.name} 主动收购 ${propertyProps.property.id} 共 ${buyAmount} 件`
            }
        );

        //给卖家添加资产
        FinancialManager.__instance.addBill(
            this.ownerId,
            {
                currency: [
                    { currency: currencyPrice, amount: price.amount * buyAmount }
                ],
                receiverId: this.ownerId,
                payerId: receiverId,
                reason: `在商店 ${this.name} 被动卖出 ${propertyProps.property.id} 共 ${buyAmount} 件`
            }
        );

        //从商店货架删除物品
        let propertyIndex = this.sellShelf.findIndex((e) => e.property.id === propertyName);
        this.sellShelf[propertyIndex].amount -= buyAmount;
        if (this.sellShelf[propertyIndex].amount <= 0) {
            this.sellShelf = this.sellShelf.filter((e) => e.property.id !== propertyProps.property.id);
        }

        //添加数据
        this.commoditySold += buyAmount;
        this.commodityCount -= buyAmount;
        this.commodityKinds = this.sellShelf.length;

        return 0;
    }

    /**
     * 尝试往商店卖
     * @param propertyName 商品的名称
     * @param sellAmount 卖出数量
     * @param payerId 卖家的玩家ID
     * @returns [1:货币不足|0:正常返回|-1:销售数量不合法]
     */
    trySell(propertyName: string, sellAmount: number, payerId: string): number {
        if (sellAmount < 1) {
            return -1;
        }

        let fData = FinancialManager.__instance.__getStorage({ playerId: this.ownerId });
        let currencyArr: Array<{ currency: Currency, amount: number }> = fData[this.ownerId]['currency'];
        //在收购货架找到指定名字的货物收购信息
        let propertyProps = this.purchaseShelf.filter((e) => e.property.id === propertyName)[0];
        if (sellAmount > propertyProps.amount) {
            sellAmount = propertyProps.amount;
        }
        let price = propertyProps.price;
        //找到价格中对应的currency:Currency对象
        let currencyPrice = currencyArr.filter((e) => e.currency.id === price.currencyId)[0].currency;

        //找到需要的货币并比较决定是否售出
        let index = currencyArr.findIndex((e) => e.currency.bindId === currencyPrice.bindId);
        if (index === -1) {
            return 1; //没有在买家的钱袋里找到指定的货币
        }
        if (fData[this.ownerId]['currency'][index].amount < price.amount * sellAmount) {
            //钱币不太够
            return 1;
        }

        //给卖家添加资产
        FinancialManager.__instance.addBill(
            payerId,
            {
                currency: [
                    { currency: currencyPrice, amount: price.amount * sellAmount }
                ],
                property: [
                    { property: propertyProps.property, amount: -sellAmount }
                ],
                receiverId: this.ownerId,
                payerId: payerId,
                reason: `在商店 ${this.name} 主动卖出 ${propertyProps.property.id} 共 ${sellAmount} 件`
            }
        );

        //给买家交易货物和资产
        FinancialManager.__instance.addBill(
            this.ownerId,
            {
                currency: [
                    { currency: currencyPrice, amount: -(price.amount * sellAmount) }
                ],
                property: [
                    { property: propertyProps.property, amount: sellAmount }
                ],
                receiverId: payerId,
                payerId: this.ownerId,
                reason: `从商店 ${this.name} 被动收购 ${propertyProps.property.id} 共 ${sellAmount} 件`
            }
        );

        //从商店收购货架删除物品
        let propertyIndex = this.purchaseShelf.findIndex((e) => e.property.id === propertyName);
        this.purchaseShelf[propertyIndex].amount -= sellAmount;
        if (this.purchaseShelf[propertyIndex].amount <= 0) {
            this.purchaseShelf = this.purchaseShelf.filter((e) => e.property.id !== propertyProps.property.id);
        }

        return 0;
    }
}
class Bill {
    //出入账单
    currency: Array<{ currency: Currency, amount: number }>;
    property: Array<{ property: Property, amount: number }>;
    receiverId: string;
    payerId: string;
    time: number; //timestamp
    reason: string;

    constructor(currency: Array<{ currency: Currency, amount: number }>, property: Array<{ property: Property, amount: number }>, receiverId: string, payerId: string, reason: string) {
        this.currency = currency;
        this.property = property;
        this.receiverId = receiverId;
        this.payerId = payerId;
        this.reason = reason;
        this.time = Date.now();
    }
}

/**
 * Property类是金融核心所接受的商品类型
 * 所有的商品物品必须要有FACoreProperty属性才能被金融核心识别
 * 例如下方是一个对象，而想让它加入商品物品:
 * {
 *   id: abc,
 *   name: cde,
 *   owner: 11334422,
 *   ...
 *   FACoreProperty: {
 *     id: abc,
 *     author: me,
 *     description: 介绍内容,
 *     value: {
 *       currencyId: <Currency>对象id,
 *       amount: 10
 *     }
 *   }
 * }
 */
class Property {
    //资产
    id: string;
    author: string;
    description: string;
    value: { cur: Currency, amount: number }

    constructor(id: string, author: string, description: string, value: { cur: Currency, amount: number }) {
        this.id = id;
        this.author = author;
        this.description = description;
        this.value = value;
    }

    static alter(alterArgs: { [key: string]: any }): Property {
        return new Property(alterArgs['id'], alterArgs['author'], alterArgs['description'], alterArgs['value']);
    }

    static alterFromObj(obj: Object): Property {
        return this.alter(obj['FACoreProperty']);
    }
}

class Currency {
    //货币
    id: string; //ID
    bindId: string;
    //以下都是展示出来的信息
    alias: string;
    currencyShorthand: string;
    conversionRatio: { [key: string]: number };
    description: string; //optional

    constructor(id: string, alias: string, currencyShorthand: string, conversionRatio: { [key: string]: number }, description: string) {
        this.id = id;
        this.bindId = id;
        this.alias = alias || null;
        if (currencyShorthand === null) {
            throw new Error("在创建货币时参数currencyShorthand缺失或无效！");
        }
        this.currencyShorthand = currencyShorthand;
        this.conversionRatio = conversionRatio || {};
        this.description = description || "";
    }
}

class FinancialManager {
    static __instance: FinancialManager = null;
    extension = null;
    currencyArr = new Array<Currency>();
    constructor(ext, currencyArr = null) {
        if (FinancialManager.__instance !== null) {
            throw new Error("CurrencyManager为单例对象，但是有试图创造更多实例的行为");
        }
        if (currencyArr !== null && currencyArr instanceof Array) {
            this.currencyArr = currencyArr;
        }
        this.extension = ext;
        FinancialManager.__instance = this;
    }

    __getStorage(kwargs: { [key: string]: any } = {}): any {

        let fetchedData = JSON.parse(this.extension.storageGet(STORAGE_NAME));
        if (fetchedData === null) {
            fetchedData = {};
        }

        //检查指定群组是否建立档案,没有就建立
        const gid = kwargs.get('groupId');
        if (gid && fetchedData[gid] === null) {
            fetchedData[gid] = {};
        }

        //检查指定群组的指定玩家是否建立档案,没有就建立
        const pid = kwargs.get('playerId');
        if (pid && fetchedData[pid] === null) {
            fetchedData[pid] = {
                'bills': [],
                'property': [],
                'currency': []
            }
        }

        //检查货币类型是否建立档案,没有就建立
        if (fetchedData['currency'] === null) {
            fetchedData['currency'] = this.currencyArr;
        }

        //检查资产档案是否建立
        if (fetchedData['property'] === null) {
            fetchedData['property'] = new Array<Property>();
        }

        //检查商店档案是否建立
        if (fetchedData['shops'] === null) {
            fetchedData['shops'] = new Array<Shop>();
        }

        return fetchedData;
    }

    __save(formedData: { [key: string]: any } = null) {
        if (formedData === null) {
            formedData = this.__getStorage();
        }
        this.extension.storageSet(STORAGE_NAME, JSON.stringify(formedData));
    }

    /**
     * 添加货币币种
     * @param alias 货币的别称
     * @param currencyShorthand 货币的缩写,例如RMB USD
     * @param conversionRatio 货币的兑换比率,例: [{'example_original_coin_name': 10}] 那么1单位此货币可兑换10单位的'originalName'属性为'exam...n_name'的货币
     * @param description 货币的介绍
     */
    //添加货币币种
    addCurrency(name: string, alias: string = null, currencyShorthand: string, conversionRatio: { [key: string]: any } = null, description: string = null) {


        let currency = new Currency(name, alias, currencyShorthand, conversionRatio, description);
        let fData = this.__getStorage();
        fData['currency'].push(currency);
        this.__save(fData);
        return 0;
    }

    /**
     * 删除指定的货币种类
     * @param id 货币的ID,可通过selectCurrency()方法查询
     */
    //删除货币币种
    deleteCurrency(id: string) {

        let fData = this.__getStorage();
        let a = (fData['currency'].filter(currency => currency.id !== id))[0];
        if (a === null) {
            return 1;
        }
        fData['currency'] = fData['currency'].filter(currency => currency.id === id);
        this.__save(fData);
        return 0;
    }

    /**
     * 修改指定的货币种类
     * @param id 货币的ID,可通过selectCurrency()方法查询
     * @param kwargs 要修改的数据,键值与addCurrency方法相同
     */
    //修改货币币种()
    updateCurrency(id: string, kwargs: { [key: string]: any }) {

        let fData = this.__getStorage();
        let currency: Currency = (fData['currency'].filter(currency => currency.id !== id))[0];
        if (currency === null) {
            //未找到
            return 1;
        }
        currency.alias = kwargs.get('alias') || currency.alias;
        currency.conversionRatio = kwargs.get('conversionRatio') || currency.conversionRatio;
        currency.description = kwargs.get('description') || currency.description;
        currency.currencyShorthand = kwargs.get('currencyShorthand') || currency.currencyShorthand;
        fData['currency'] = fData['currency'].filter(currency => currency.id === id);
        fData['currency'].push(currency);
        this.__save(fData);
        return 0;
    }

    /**
     * 查询货币
     * @param kwargs 查询的条件,可以多种,例如:{id:'标准货币','currencyShorthand':'Coin'}
     */
    //查询货币币种
    selectCurrency(kwargs: { [key: string]: any }): Array<Currency> {

        let fData = this.__getStorage();
        let id = kwargs.get('id');
        let name = kwargs.get('name');
        let alias = kwargs.get('alias');
        let description = kwargs.get('description');
        let currencyShorthand = kwargs.get('currencyShorthand');
        let resArr = [];
        for (let i = 0; i < fData['currency'].length; i++) {
            let comp: Currency = fData['currency'][i];
            if (id !== null && comp['id'].includes(id) && !resArr.includes(comp)) {
                resArr.push(comp);
                continue;
            }
            if (name !== null && comp['name'].includes(name) && !resArr.includes(comp)) {
                resArr.push(comp);
                continue;
            }
            if (alias !== null && comp['alias'].includes(alias) && !resArr.includes(comp)) {
                resArr.push(comp);
                continue;
            }
            if (description !== null && comp['description'].includes(description) && !resArr.includes(comp)) {
                resArr.push(comp);
                continue;
            }
            if (currencyShorthand !== null && comp['currencyShorthand'].includes(currencyShorthand) && !resArr.includes(comp)) {
                resArr.push(comp);
                continue;
            }
        }
        return resArr;
    }
    /**
     * 添加账单
     * @param playerId 玩家ID
     * @param kwargs 添加的参数:
            currency: Array<{ currency: Currency, amount: number }>; A组二选一或都选
            property: Array<{ property: Property, amount: number }>; A组二选一或都选
            receiverId: string; 可选
            payerId: string; 必要
            reason: string; 可选
     */
    //添加账单
    addBill(playerId: string, kwargs: { [key: string]: any }, b: Bill = null) {

        let bill: Bill = null;
        let fData = this.__getStorage({ 'playerId': playerId });

        let currency = kwargs.get('currency');
        let property = kwargs.get('property');
        let receiverId = playerId;
        let payerId = kwargs.get('payerId');
        let reason = kwargs.get('reason');

        if ((currency === null && property === null) || payerId === null) {
            return -1;
        }

        if (b === null) {
            bill = new Bill(currency, property, receiverId, payerId, reason);
        } else {
            bill = b;
        }

        fData[playerId]['bills'].unshift(bill);

        //添加资产
        for (let i = 0; i < property.length; i++) {
            let p = property[i];
            let pId = p.property.id;
            let amount = p.amount;

            let index = -1
            if (fData[playerId]['property'].length !== 0) {
                index = fData[playerId]['property'].findIndex((e) => e.property.id == pId);
            }
            if (index !== -1) {
                //找到了有的资产
                fData[playerId]['property'][index].amount += amount;
            } else {
                //没找到资产，添加
                fData[playerId]['property'].unshift(p);
            }
        }
        // 去除被删除完的
        fData[playerId]['property'] = fData[playerId]['property'].filter((e) => e.amount <= 0);

        //添加钱币
        for (let i = 0; i < currency.length; i++) {
            let c = currency[i];
            let cId = c.currency.id;
            let amount = c.amount;

            let index = -1;
            if (fData[playerId]['currency'].length !== 0) {
                index = fData[playerId]['currency'].findIndex((e) => e.currency.bindId == cId);
            }
            if (index !== -1) {
                //找到了有的货币
                fData[playerId]['currency'][index].amount += amount;
            } else {
                //没找到货币，添加
                fData[playerId]['currency'].unshift(c);
            }
        }
        // 去除被删除完的
        fData[playerId]['currency'] = fData[playerId]['currency'].filter((e) => e.amount <= 0);

        this.__save(fData);
        return 0;
    }

    /**
     * 查询指定账单
     * @param playerId 玩家的ID
     * @param page 要查询的页数,默认为1
     * @param kwargs 查询使用参数，可以为空
     */
    //查询账单
    selectBill(playerId: string, page: number = 1, kwargs: { [key: string]: any } = null): { arr: Array<Bill>, pageSum: number } {

        let fData = this.__getStorage({ 'playerId': playerId });
        let bills: Array<Bill> = fData[playerId]['bills'];
        let resultArray = bills;

        if (bills.length === 0) {
            return { arr: [], pageSum: 1 };
        }

        //指定时间前/后
        let timeBefore = kwargs.get('timeBefore');
        if (timeBefore !== null) {
            resultArray = resultArray.filter((obj) => obj.time < dateToTimestamp(timeBefore));
        }
        let timeAfter = kwargs.get('timeAfter');
        if (timeAfter !== null) {
            resultArray = resultArray.filter((obj) => obj.time > dateToTimestamp(timeAfter));
        }

        //指定来自于...
        let payerId = kwargs.get('payerId');
        if (payerId !== null) {
            resultArray = resultArray.filter((obj) => obj.payerId === payerId);
        }

        //分页
        let chunks = splitArrayIntoChunks(resultArray, 5);
        let pageSum = chunks.length;

        if (page > pageSum) {
            page = pageSum;
        }
        else if (page < 1) {
            page = 1;
        }

        //返回指定页
        return { arr: chunks[page], pageSum: pageSum };
    }

    /**
     * 查询指定资产
     * @param playerId 玩家的ID
     * @param kwargs 查询使用参数，可以为空
     */
    selectProperty(playerId: string, kwargs: { [key: string]: any } = null): Array<Property> {

        let fData = this.__getStorage({ 'playerId': playerId });
        let propertyArr: Array<Property> = fData[playerId]['property'];
        let resultArray = propertyArr;

        if (propertyArr.length === 0) {
            return [];
        }

        //指定id包含
        let idToSelect = kwargs.get('id');
        if (idToSelect !== null) {
            resultArray = resultArray.filter((obj) => obj.id === idToSelect);
        }

        return resultArray;
    }

    /**
     * 查询用户的钱币
     * @param playerId 玩家的ID
     */
    selectOwnerCurrency(playerId: string): Array<{ currency: Currency, amount: number }> {

        let fData = this.__getStorage({ 'playerId': playerId });
        let CurArr = fData[playerId]['currency'];
        return CurArr;
    }

    /**
     * 检查是否为有效的可作为商品被识别的物品
     * @param obj 要检测的对象
     * @returns 是否为有效商品
     */
    checkIsValidProperty(obj: Object): boolean {
        let flag = true;
        let altered = Property.alterFromObj(obj);
        if (altered === null) {
            flag = false;
        }
        return flag
    }

    /**
     * 进入到指定的商店
     * @param id 商店的ID
     * @param playerId 玩家的ID
     * @returns [-1:商店不存在|0:正常返回]
     */
    enterShop(id: string, playerId: string): number {
        let fData = this.__getStorage({ 'playerId': playerId });
        if ((fData['shops'].findIndex((e: Shop) => e.id === id)) === -1) {
            fData[playerId]['currentShop'] = null;
            return -1;
        }
        fData[playerId]['currentShop'] = id;
        this.__save(fData);
        return 0;
    }

    /**
     * 添加玩家自己的商店的出售物品
     * @param shopOwnerId 玩家的ID
     * @param propertyName 物品资产的名字
     * @param amount 数量
     * @param price 价格:{currencyId:string, amount:number}
     * @returns [-1:上架个数无效|0:正常返回|1:商品在背包内不存在|2:该玩家没有商店]
     */
    addShopSell(shopOwnerId: string, propertyName: string, amount: number, price: { currencyId: string, amount: number }): number {
        let fData = this.__getStorage({ 'playerId': shopOwnerId });
        //找到对应的商品对象
        let propertyIndex = fData[shopOwnerId]['property'].findIndex((e: { property: Property, amount: number }) => e.property.id === propertyName);
        if (propertyIndex === -1) {
            return 1;
        }
        let property: Property = fData[shopOwnerId]['property'][propertyIndex].property;

        //检查amount
        if (amount < 1) {
            return -1;
        }
        else if (amount > fData[shopOwnerId]['property'][propertyIndex].amount) {
            amount = fData[shopOwnerId]['property'][propertyIndex].amount;
        }

        //找到玩家的商店
        let shopIndex = fData['shops'].findIndex((e: Shop) => e.ownerId === shopOwnerId);
        if (shopIndex === -1) {
            return 2;
        }
        let shop: Shop = fData['shops'][shopIndex];

        //上架物品，删除玩家背包内物品
        shop.sellShelf.unshift({ property: property, price: price, amount: amount });
        fData['shops'][shopIndex] = shop;
        fData[shopOwnerId]['property'][propertyIndex].amount -= amount;
        if (fData[shopOwnerId]['property'][propertyIndex].amount <= 0) {
            fData[shopOwnerId]['property'] = fData[shopOwnerId]['property'].filter((e) => e.property.id !== propertyName);
        }

        this.__save(fData);
    }


    /**
     * 从上架的货架上撤去物品
     * @param shopOwnerId 玩家的ID
     * @param propertyName 资产的名称
     * @returns [0:正常返回|1:商品在背包内不存在|2:该玩家没有商店]
     */
    cancelShopSell(shopOwnerId: string, propertyName: string): number {
        let fData = this.__getStorage({ 'playerId': shopOwnerId });

        //找到玩家的商店
        let shopIndex = fData['shops'].findIndex((e: Shop) => e.ownerId === shopOwnerId);
        if (shopIndex === -1) {
            return 2;
        }
        let shop: Shop = fData['shops'][shopIndex];

        //找到对应的商品对象
        let propertyIndex = shop.sellShelf.findIndex((e) => e.property.id === propertyName);
        if (propertyIndex === -1) {
            return 1;
        }
        let property: Property = shop.sellShelf[propertyIndex].property;

        //下架物品，添加玩家背包内物品
        let amount = shop.sellShelf[propertyIndex].amount;
        shop.sellShelf = shop.sellShelf.filter((e) => e.property.id !== property.id);
        fData['shops'][shopIndex] = shop;

        //添加资产
        let index = -1;
        if (fData[shopOwnerId]['property'].length !== 0) {
            index = fData[shopOwnerId]['property'].findIndex((e) => e.property.id == propertyName);
        }
        if (index !== -1) {
            //找到了有的资产
            fData[shopOwnerId]['property'][index].amount += amount;
        } else {
            //没找到资产，添加
            fData[shopOwnerId]['property'].unshift({ property: property, amount: amount });
        }

        this.__save(fData);
        return 0;
    }

    /**
     * 添加玩家自己的商店的收购物品
     * @param shopOwnerId 玩家的ID
     * @param propertyName 物品资产的名字
     * @param amount 数量
     * @param price 价格:{currencyId:string, amount:number}
     * @returns [-1:收购个数无效|0:正常返回|1:商品在游戏内不存在|2:该玩家没有商店]
     */
    addShopPurchase(shopOwnerId: string, propertyName: string, amount: number, price: { currencyId: string, amount: number }): number {
        let fData = this.__getStorage({ 'playerId': shopOwnerId });
        //找到对应的商品对象
        let propertyIndex = fData['property'].findIndex((e: Property) => e.id === propertyName);
        if (propertyIndex === -1) {
            return 1;
        }
        let property: Property = fData['property'][propertyIndex].property;

        //找到玩家的商店
        let shopIndex = fData['shops'].findIndex((e: Shop) => e.ownerId === shopOwnerId);
        if (shopIndex === -1) {
            return 2;
        }
        let shop: Shop = fData['shops'][shopIndex];

        //检查amount
        if (amount < 1) {
            return -1;
        }

        //添加收购物品
        shop.purchaseShelf.unshift({ property: property, price: price, amount: amount });
        fData['shops'][shopIndex] = shop;

        this.__save(fData);
        return 0;
    }

    /**
     * 取消要收购的物品资产
     * @param shopOwnerId 商店的玩家ID
     * @param propertyName 资产的名称
     * @returns [0:正常返回|1:商品在收购清单不存在|2:该玩家没有商店]
     */
    cancelShopPurchase(shopOwnerId: string, propertyName: string): number {
        let fData = this.__getStorage({ 'playerId': shopOwnerId });

        //找到玩家的商店
        let shopIndex = fData['shops'].findIndex((e: Shop) => e.ownerId === shopOwnerId);
        if (shopIndex === -1) {
            return 2;
        }
        let shop: Shop = fData['shops'][shopIndex];

        //找到对应的商品对象
        let propertyIndex = shop.purchaseShelf.findIndex((e) => e.property.id === propertyName);
        if (propertyIndex === -1) {
            return 1;
        }
        let property: Property = shop.purchaseShelf[propertyIndex].property;

        shop.purchaseShelf = shop.purchaseShelf.filter((e) => e.property.id !== propertyName);
        fData['shops'][shopIndex] = shop;

        this.__save(fData);
        return 0;
    }

    /**
     * 购买物品的方法
     * @param buyerId 购买者的ID
     * @param propertyName 购买的物品资产名
     * @param amount 购买数量
     * @returns [1:货币不足|0:正常返回|-1:购买数量不合法]
     */
    buyItem(buyerId: string, propertyName: string, amount: number): number {
        //购买物品

        let fData = this.__getStorage({ playerId: buyerId });

        //获取用户所在的商店
        let shopId = fData[buyerId]['currentShop'];
        let shopIndex = fData['shops'].findIndex((e: Shop) => e.id === shopId);
        let shop: Shop = fData['shops'][shopIndex];

        const resNum = shop.tryBuy(propertyName, amount, buyerId);
        return resNum;
    }

    /**
     * 出售物品的方法
     * @param sellerId 销售者的ID
     * @param propertyName 销售的物品资产名
     * @param amount 销售数量
     * @returns [1:货币不足|0:正常返回|-1:销售数量不合法]
     */
    sellItem(sellerId: string, propertyName: string, amount: number): number {
        //销售物品

        let fData = this.__getStorage({ playerId: sellerId });

        //获取用户所在的商店
        let shopId = fData[sellerId]['currentShop'];
        let shopIndex = fData['shops'].findIndex((e: Shop) => e.id === shopId);
        let shop: Shop = fData['shops'][shopIndex];

        const resNum = shop.trySell(propertyName, amount, sellerId);
        return resNum;
    }

    /**
     * 查询商店列表
     * @param kwargs 查询的参数{[key:string]:any}
     * @returns Array<Shop>
     */
    selectShop(kwargs: { [key: string]: any } = null) {
        //选择商店
        let fData = this.__getStorage();
        return fData['shops'];
    }

    __checkShopName(shopName: string): boolean {
        let fData = this.__getStorage();
        let index = fData['shops'].findIndex((e: Shop) => e.id === shopName);
        if (index === -1) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * 玩家创建商店的方法
     * @param playerId 玩家ID
     * @param kwargs 创建参数列表
     * @returns [-1:缺乏必要参数name和intro和description|0:正常返回|1:name参数重复]
     */
    createShop(playerId: string, kwargs: { [key: string]: any }): number {
        //创建商店
        let fData = this.__getStorage({playerId:playerId});

        let name = kwargs['name'];
        let intro = kwargs['intro'];
        let description = kwargs['description'];

        if (name === null || intro === null || description === null) {
            return -1;
        }

        if (!this.__checkShopName(name)) {
            return 1;
        }

        fData['shops'].unshift(new Shop(name, intro, description, playerId));
        this.__save(fData);
        return 0;
    }

    /**
     * 更新商店信息
     * @param playerId 
     * @param kwargs 
     * @returns [-1:缺乏必要参数id|0:正常返回|1:name参数重复]
     */
    updateShop(playerId, kwargs: { [key: string]: any }): number {
        let fData = this.__getStorage({ playerId: playerId });
        let id = kwargs['id'];
        let name = kwargs['name'];
        let intro = kwargs['intro'];
        let description = kwargs['description'];

        if (id === null) {
            return -1;
        }

        if (!this.__checkShopName(name)) {
            return 1;
        }

        let shopIndex = fData['shops'].findIndex((e) => e.id === id);
        fData['shops'][shopIndex]['name'] = name || fData['shops'][shopIndex]['name'];
        fData['shops'][shopIndex]['intro'] = intro || fData['shops'][shopIndex]['intro'];
        fData['shops'][shopIndex]['description'] = description || fData['shops'][shopIndex]['description'];
        this.__save(fData);

        return 0;
    }
}