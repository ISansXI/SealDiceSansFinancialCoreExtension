const STORAGE_NAME = "SansFinacialCore"

class Bill {
    //出入账单
    amount: number;
    currency: Currency;
    receiverId: string;
    payerId: string;
    time: number; //timestamp
    reason: string;

    constructor(amount: number, currency: Currency, receiverId: string, payerId: string, reason: string) {
        this.amount = amount;
        this.currency = currency;
        this.receiverId = receiverId;
        this.payerId = payerId;
        this.reason = reason;
        this.time = Date.now();
    }
}

class Currency {
    //货币
    id: string; //ID
    //以下都是展示出来的信息
    name: string;
    alias: Array<string>;
    currencyShorthand: string;
    conversionRatio: { [key: string]: number };
    description: string; //optional

    constructor(name: string, alias: Array<string>, currencyShorthand: string, conversionRatio: { [key: string]: number }, description: string) {
        this.name = name;
        this.alias = alias || [];
        if(currencyShorthand === null) {
            throw new Error("在创建货币时参数currencyShorthand缺失或无效！");
        }
        this.currencyShorthand = currencyShorthand;
        this.conversionRatio = conversionRatio || {};
        this.description = description || "";
        this.id = name;
    }
}

class FinancialManager {
    static __instance = null;
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
        if (pid && gid && fetchedData[gid][pid] === null) {
            fetchedData[gid][pid] = {
                'bills': [],
                'property': []
            }
        }

        //检查货币类型是否建立档案,没有就建立
        if (fetchedData['currency'] === null) {
            fetchedData['currency'] = this.currencyArr;
        }

        return fetchedData;
    }

    __save(formedData: { [key: string]: any } = null) {
        if(formedData === null) {
            formedData = this.__getStorage();
        }
        this.extension.storageSet(STORAGE_NAME, JSON.stringify(formedData));
    }

    //添加货币币种
    addCurrency(name: string, alias: Array<string> = null, currencyShorthand: string, conversionRatio: { [key: string]: number } = null, description: string = null, ctx: seal.MsgContext) {
        /**
         * 添加货币币种
         * @param name 货币名称
         * @param alias 货币的别称
         * @param currencyShorthand 货币的缩写,例如RMB USD
         * @param conversionRatio 货币的兑换比率,例: {'example_original_coin_name': 10} 那么1单位此货币可兑换10单位的'originalName'属性为'exam...n_name'的货币
         * @param description 货币的介绍
         * @param ctx :seal.MsgContext 必需
         */
        let currency = new Currency(name, alias, currencyShorthand, conversionRatio, description);
        let fData = this.__getStorage();
        fData['currency'].push(currency);
        this.__save(fData);
    }

    //删除货币币种
    deleteCurrency(id: string) {
        /**
         * 删除指定的货币种类
         * @param id 货币的ID,可通过selectCurrency()方法查询
         */
        let fData = this.__getStorage();
        fData['currency'] = fData['currency'].filter(currency => currency.id === id);
        this.__save(fData);
    }

    //修改货币币种()
    updateCurrency(id:string, kwargs: {[key: string]: any}) {
        /**
         * 修改指定的货币种类
         * @param id 货币的ID,可通过selectCurrency()方法查询
         * @param kwargs 要修改的数据,键值与addCurrency方法相同
         */
        let fData = this.__getStorage();
        let currency: Currency = fData['currency'].filter(currency => currency.id !== id);
        currency.name = kwargs.get('name') || currency.name;
        currency.alias = kwargs.get('alias') || currency.alias;
        currency.conversionRatio = kwargs.get('conversionRatio') || currency.conversionRatio;
        currency.description = kwargs.get('description') || currency.description;
        currency.currencyShorthand = kwargs.get('currencyShorthand') || currency.currencyShorthand;
        fData['currency'] = fData['currency'].filter(currency => currency.id === id);
        fData['currency'].push(currency);
        this.__save(fData);
    }

    //查询货币币种
    selectCurrency() {

    }

    //添加账单
    addBill() {

    }

    //查询账单
    selectBill() {

    }
}


