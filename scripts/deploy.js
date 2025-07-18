// scripts/deploy.js
const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    const deployments = {};

    // 部署 MockV3Aggregator (价格预言机)
    const MockPriceFeed = await ethers.getContractFactory("MockV3Aggregator");
    const priceFeed = await MockPriceFeed.deploy(8, 2000 * 1e8); // 小数位 8，初始价格 2000 * 10^8
    await priceFeed.waitForDeployment();
    deployments.PriceFeed = await priceFeed.getAddress();
    console.log("MockV3Aggregator deployed to:", deployments.PriceFeed);

    // 部署 MockERC20 (测试代币)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const erc20Token = await MockERC20.deploy("MockToken", "MTK"); // 名称: MockToken, 符号: MTK
    await erc20Token.waitForDeployment();
    deployments.ERC20 = await erc20Token.getAddress();
    console.log("MockERC20 deployed to:", deployments.ERC20);

    // 部署 Auction 实现合约
    const Auction = await ethers.getContractFactory("Auction");
    const auctionImpl = await Auction.deploy();
    await auctionImpl.waitForDeployment();
    deployments.AuctionImpl = await auctionImpl.getAddress();
    console.log("Auction implementation deployed to:", deployments.AuctionImpl);

    // 部署 AuctionFactory 代理
    const AuctionFactory = await ethers.getContractFactory("AuctionFactory");
    const auctionFactory = await upgrades.deployProxy(AuctionFactory, [deployments.AuctionImpl], { kind: "uups" });
    await auctionFactory.waitForDeployment();
    deployments.AuctionFactory = await auctionFactory.getAddress();
    console.log("AuctionFactory deployed to:", deployments.AuctionFactory);

    // 部署 MyNFT
    const MyNFT = await ethers.getContractFactory("MyNFT");
    const myNFT = await MyNFT.deploy();
    await myNFT.waitForDeployment();
    deployments.MyNFT = await myNFT.getAddress();
    console.log("MyNFT deployed to:", deployments.MyNFT);

    // 保存部署地址
    fs.writeFileSync("deployments.json", JSON.stringify(deployments, null, 2));
    console.log("Deployments saved to deployments.json");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});