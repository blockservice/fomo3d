# 合约部署

利用[Remix](https://remix.ethereum.org/#optimize=false&version=soljson-v0.4.24+commit.e67f0147.js)在线手动部署合约。

1. 依次部署Team、PlayberBook、fomo3d.sol合约，记得替换各自合约依赖的地址。

2. 部署完毕后，需要激活

    `activate`和`setOtherFomo`，最后在Playbook里还要设置`addGame`,这样整个系统就运转起来了。

当前目录下的play和team里我写死了reward地址，一个是收取官网直投返佣的收益，另一个是收取注册推广链接那0.01ETH的费用

`note`:

origin目录里是原版的合约内容

