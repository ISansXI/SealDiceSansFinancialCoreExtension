import "./utils";

function main() {
  // 注册扩展
  let ext = seal.ext.find('SansFinancialCore');
  if (!ext) {
    ext = seal.ext.new('SansFinancialCore', '地星 AKA Sans', '1.0.0');

    // 编写指令
    const cmdSeal = seal.ext.newCmdItemInfo();
    cmdSeal.name = '地星的金融核心';
    cmdSeal.help = '这是地星的金融核心';

    cmdSeal.solve = (ctx, msg, cmdArgs) => {
      let val = cmdArgs.getArgN(1);
      switch (val) {
        case '':
        case 'help': {
          const ret = seal.ext.newCmdExecuteResult(true);
          ret.showHelp = true;
          return ret;
        }
        case 'currency':
        case '货币': {
          let v2 = cmdArgs.getArgN(2);
          switch (v2) {
            case 'add':
            case '添加': {
              let v3 = cmdArgs.getArgN(3);
              let v3Converted: { [key: string]: any } = eval(v3);
              let name = v3Converted['name'];
              let alias = v3Converted['alias'] || null;
              let currencyShorthand = v3Converted['currencyShorthand'] || 'Coin';
              let conversionRatio = v3Converted['conversionRatio'] || null;
              let description = v3Converted['description'] || null;
              FinancialManager.__instance.addCurrency(name, alias, currencyShorthand, conversionRatio, description);
            }
            case '修改':
            case 'update': {
              let v3 = cmdArgs.getArgN(3);
              let v3Converted: { [key: string]: any } = eval(v3);
              let id = v3Converted['id'];
              if (id === null) {
                seal.replyToSender(ctx, msg, "id字段不可为空");
              } else {
                const res = FinancialManager.__instance.updateCurrency(id, v3Converted);
                if (res === 1) {
                  seal.replyToSender(ctx, msg, "未找到指定货币id");
                } else if (res === 0) {
                  seal.replyToSender(ctx, msg, "修改成功");
                }
              }
            }
            case 'select':
            case '查询': {
              let v3 = cmdArgs.getArgN(3);
              let v3Converted: { [key: string]: any } = eval(v3);
              let res = FinancialManager.__instance.selectCurrency(v3Converted);
              seal.replyToSender(ctx, msg, JSON.stringify(res));
            }
            case 'delete':
            case '删除': {
              let v3 = cmdArgs.getArgN(3);
              if (v3 === null) {
                seal.replyToSender(ctx, msg, "id字段不可为空");
              } else {
                const res = FinancialManager.__instance.deleteCurrency(v3);
                if (res === 1) {
                  seal.replyToSender(ctx, msg, "未找到指定货币id");
                } else if (res === 0) {
                  seal.replyToSender(ctx, msg, "删除成功");
                }
              }
            }
          }
        }
        case 'bill':
        case '账单': {
          let v2 = cmdArgs.getArgN(2);
          switch (v2) {
            case 'list':
            case '列表': {

            }
          }
        }
        default: {

        }
      }
      return seal.ext.newCmdExecuteResult(true);
    }

    // 注册命令
    ext.cmdMap['fi'] = cmdSeal;
    ext.cmdMap['金融核心'] = cmdSeal;
    ext.cmdMap['金核'] = cmdSeal;
    ext.cmdMap['财政'] = cmdSeal;


    seal.ext.register(ext);
    globalThis.financialCore = new FinancialManager(ext);
  }
}

main();
