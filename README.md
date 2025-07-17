# NFT 拍卖市场

## 项目概述
这是一个基于 Hardhat 的 NFT 拍卖市场，支持 ERC721 NFT 拍卖、Chainlink 预言机价格查询、UUPS 代理升级和工厂模式管理。

## 功能
- **NFT 合约**：支持铸造、转移和元数据管理。
- **拍卖合约**：支持以太坊和 ERC20 出价，集成 Chainlink 预言机计算美元价值。
- **工厂合约**：管理多个拍卖实例，类似于 Uniswap V2。
- **升级机制**：使用 UUPS 代理模式支持合约升级。

## 部署步骤
1. 安装依赖：`npm install`
2. 配置 Hardhat：修改 `hardhat.config.js` 添加测试网配置。
3. 部署合约：`npx hardhat run scripts/deploy.js --network <network>`

## 测试
运行测试：`npx hardhat test`
测试覆盖：
- NFT 铸造和元数据
- 拍卖创建、出价、结束
- 美元价格转换
- 工厂模式管理

## 部署地址
（测试网部署后补充）

## 额外功能
- 动态手续费：支持基于拍卖金额的动态手续费（在 Auction 合约中设置 feePercentage）。
- 跨链拍卖：可通过 Chainlink CCIP 扩展（未完全实现，需额外配置）。

## 代码结构
- `contracts/`：包含 MyNFT.sol、Auction.sol、AuctionFactory.sol
- `test/`：包含单元测试
- `scripts/`：包含部署脚本