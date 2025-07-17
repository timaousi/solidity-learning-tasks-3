const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    // 部署 Mock 预言机和 ERC20
    const MockPriceFeed = await ethers.getContractFactory("MockV3Aggregator");
    const priceFeed = await MockPriceFeed.deploy(8, 2000 * 1e8);
    await priceFeed.waitForDeployment();
    console.log("PriceFeed deployed to:", await priceFeed.getAddress());

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const erc20Token = await MockERC20.deploy("MockToken", "MTK");
    await erc20Token.waitForDeployment();
    console.log("ERC20 deployed to:", await erc20Token.getAddress());

    // 部署 NFTAuction
    const NFTAuction = await ethers.getContractFactory("NFTAuction");
    const nftAuctionImpl = await NFTAuction.deploy();
    await nftAuctionImpl.waitForDeployment();
    const Proxy = await ethers.getContractFactory("ERC1967Proxy");
    const initData = NFTAuction.interface.encodeFunctionData("initialize");
    const nftProxy = await Proxy.deploy(nftAuctionImpl.getAddress(), initData);
    await nftProxy.waitForDeployment();
    console.log("NFTAuction deployed to:", await nftProxy.getAddress());

    // 部署 Auction 和 AuctionFactory
    const Auction = await ethers.getContractFactory("Auction");
    const auctionImpl = await Auction.deploy();
    await auctionImpl.waitForDeployment();

    const AuctionFactory = await ethers.getContractFactory("AuctionFactory");
    const factoryImpl = await AuctionFactory.deploy();
    await factoryImpl.waitForDeployment();
    const factoryInitData = AuctionFactory.interface.encodeFunctionData("initialize", [await auctionImpl.getAddress()]);
    const factoryProxy = await Proxy.deploy(factoryImpl.getAddress(), factoryInitData);
    await factoryProxy.waitForDeployment();
    console.log("AuctionFactory deployed to:", await factoryProxy.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});