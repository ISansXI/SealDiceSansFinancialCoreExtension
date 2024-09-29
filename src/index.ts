import "./utils";

function removeSubstring(ostr: string, strtd: string): string {
  return ostr.replace(new RegExp(strtd, 'g'), '');
}

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
              if (ctx.privilegeLevel < 100) {
                seal.replyToSender(ctx, msg, "你没有权限这么做");
              } else {
                let v3 = cmdArgs.getRestArgsFrom(3).split(' ').join('');
                if (!isValidJSON(v3)) {
                  seal.replyToSender(ctx, msg, "参数格式不符合JSON格式");
                } else {
                  let v3Converted: { [key: string]: any } = eval(v3);
                  let id = v3Converted['id'];
                  let alias = v3Converted['alias'] || null;
                  let currencyShorthand = v3Converted['currencyShorthand'] || 'Coin';
                  let conversionRatio = v3Converted['conversionRatio'] || null;
                  let description = v3Converted['description'] || null;
                  FinancialManager.__instance.addCurrency(id, alias, currencyShorthand, conversionRatio, description);
                  seal.replyToSender(ctx, msg, "添加货币成功");
                }
              }
            }
            case '修改':
            case 'update': {
              if (ctx.privilegeLevel < 100) {
                seal.replyToSender(ctx, msg, "你没有权限这么做");
              } else {
                let v3 = cmdArgs.getRestArgsFrom(3).split(' ').join('');
                if (!isValidJSON(v3)) {
                  seal.replyToSender(ctx, msg, "参数格式不符合JSON格式");
                } else {
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
              if (ctx.privilegeLevel < 100) {
                seal.replyToSender(ctx, msg, "你没有权限这么做");
              } else {
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
        }
        case 'bill':
        case '账单': {
          let v2 = cmdArgs.getArgN(2);
          switch (v2) {
            case 'list':
            case '列表': {
              let v3 = cmdArgs.getArgN(3);
              let v3n = Number.parseInt(v3);
              if (v3n < 1) {
                v3n = 1;
              }
              let kwargs = cmdArgs.getRestArgsFrom(4);
              kwargs = kwargs.replace(/\s+/g, '');
              if (!isValidJSON(kwargs)) {
                seal.replyToSender(ctx, msg, "参数格式不符合JSON格式");
              } else {
                let res = FinancialManager.__instance.selectBill(ctx.player.userId, v3n, eval(kwargs));
                let rt = `以下为${ctx.player.name}的账单:\n\n`;
                if (v3n > res.pageSum) {
                  v3n = res.pageSum;
                }
                for (let i = 0; i < res.arr.length; i++) {
                  rt += `[${timestampToDateExactFormat(res.arr[i].time)}]创建的订单↓\n`;
                  rt += `钱币: ${res.arr[i].currency}\n`;
                  rt += `资产: ${res.arr[i].property}\n`;
                  rt += `接收人: ${res.arr[i].receiverId}\n`;
                  rt += `发送人: ${res.arr[i].payerId}\n`;
                  rt += `原因: ${res.arr[i].reason}\n\n`
                }
                rt += `|第 ${v3n} 页 | 共 ${res.pageSum} 页|`;
                seal.replyToSender(ctx, msg, rt);
              }
            }
            case '添加':
            case 'add': {
              if (ctx.privilegeLevel < 100) {
                seal.replyToSender(ctx, msg, "你没有权限这么做");
              } else {
                let v3 = cmdArgs.getRestArgsFrom(3).split(' ').join('');
                if (!isValidJSON(v3)) {
                  seal.replyToSender(ctx, msg, "参数格式不符合JSON格式");
                } else {
                  FinancialManager.__instance.addBill(ctx.player.userId, eval(v3));
                  seal.replyToSender(ctx, msg, "添加资产成功");
                }
              }
            }
          }
        }
        case '商店':
        case 'shop': {
          let v2 = cmdArgs.getArgN(2);
          switch (v2) {
            case '存款':
            case 'money': {
              let ownCurrency = FinancialManager.__instance.selectOwnerCurrency(ctx.player.userId);
              let rt = `玩家${ctx.player.name}的剩余钱币:\n`;
              for (let i = 0; i < ownCurrency.length; i++) {
                rt += ownCurrency[i] + '\n';
              }
              seal.replyToSender(ctx, msg, rt);
            }
            case '进入':
            case 'enter': {
              let v3 = cmdArgs.getArgN(3);
              const res = FinancialManager.__instance.enterShop(v3, ctx.player.userId);
              if (res === -1) {
                seal.replyToSender(ctx, msg, '该商店不存在');
              }
              else if (res === 0) {
                seal.replyToSender(ctx, msg, `玩家${ctx.player.name}走进了商店${v3}`);
              }
            }
            case '创建':
            case 'create': {
              let v3 = cmdArgs.getRestArgsFrom(3).split(' ').join('');
              if (!isValidJSON(v3)) {
                seal.replyToSender(ctx, msg, '参数格式不符合JSON格式');
              } else {
                const res = FinancialManager.__instance.createShop(ctx.player.userId, eval(v3))
                if (res === -1) {
                  seal.replyToSender(ctx, msg, '缺少name、intro、description参数之一');
                }
                else if (res === 0) {
                  seal.replyToSender(ctx, msg, `创建商店${eval(v3)['name']}成功`);
                }
                else if (res === 1) {
                  seal.replyToSender(ctx, msg, `商店名字与已知的商店重复`);
                }
              }
            }
            case '更新':
            case 'update': {
              let v3 = cmdArgs.getRestArgsFrom(3).split(' ').join('');
              if (!isValidJSON(v3)) {
                seal.replyToSender(ctx, msg, '参数格式不符合JSON格式');
              } else {
                const res = FinancialManager.__instance.updateShop(ctx.player.userId, eval(v3))
                if (res === -1) {
                  seal.replyToSender(ctx, msg, '缺少id参数(id为最初始创建商店所用的名字)');
                }
                else if (res === 0) {
                  seal.replyToSender(ctx, msg, `修改商店${eval(v3)['id']}成功`);
                }
                else if (res === 1) {
                  seal.replyToSender(ctx, msg, `商店名字与已知的商店重复`);
                }
              }
            }
            case '售卖':
            case 'sell': {

            }
            case '购买':
            case 'buy': {

            }
            case '添加收购':
            case 'addPurchase': {

            }
            case '删除收购':
            case 'cancelPurchase': {

            }
            case '上架':
            case 'addGood': {

            }
            case '下架':
            case 'cancelGood': {

            }
          }
        }
        default: {

        }
      }
      return seal.ext.newCmdExecuteResult(true);
    }

    // 注册命令
    ext.cmdMap['fa'] = cmdSeal;
    ext.cmdMap['financial'] = cmdSeal;
    ext.cmdMap['金融核心'] = cmdSeal;
    ext.cmdMap['金核'] = cmdSeal;
    ext.cmdMap['财政'] = cmdSeal;


    seal.ext.register(ext);
    globalThis.financialCore = new FinancialManager(ext);
  }
}

main();
