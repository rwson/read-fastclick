# read-fastclick

fastclick是一个兼容移动端click事件的js库,在移动端事件的执行顺序是touchestart->touchend->click(网上一大堆关于这个的说明),所以等执行到click的时候,难免会卡顿,在老机器上该问题更加明显,现在有很多库来解决这个问题,touch.js(百度)、tap(以zepto为代表)等等。

闲来无事,拜读下fastclick这个库的源码。
