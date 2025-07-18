// SPDX-License-Identifier: MIT
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { upgrades } = require("hardhat");

describe("AuctionFactory Contract", function () {
    let MyNFT, Auction, AuctionFactory, MockERC20, MockPriceFeed;
    let myNFT, auctionFactory, erc20Token, priceFeed;
    let owner, seller;

    beforeEach(async function () {
        [owner, seller] = await ethers.getSigners();

        // 部署 MockERC20
        MockERC20 = await ethers.getContractFactory("MockERC20");
        erc20Token = await MockERC20.deploy("MockToken", "MTK");
        await erc20Token.waitForDeployment();

        // 部署 MockPriceFeed
        MockPriceFeed = await ethers.getContractFactory("MockV3Aggregator");
        priceFeed = await MockPriceFeed.deploy(8, 2000 * 1e8);
        await priceFeed.waitForDeployment();

        // 部署 MyNFT
        MyNFT = await ethers.getContractFactory("MyNFT");
        myNFT = await MyNFT.deploy();
        await myNFT.waitForDeployment();

        // 部署 Auction 实现合约
        Auction = await ethers.getContractFactory("Auction");
        const auctionImpl = await Auction.deploy();
        await auctionImpl.waitForDeployment();

        // 部署 AuctionFactory（UUPS 代理）
        AuctionFactory = await ethers.getContractFactory("AuctionFactory");
        auctionFactory = await upgrades.deployProxy(AuctionFactory, [await auctionImpl.getAddress()], {
            kind: 'uups',
            initializer: 'initialize'
        });
        await auctionFactory.waitForDeployment();
    });

    describe("Auction Creation", function () {
        let tokenId;

        beforeEach(async function () {
            const mintTx = await myNFT.connect(owner).mint(seller.address, "ipfs://test/creation");
            const mintReceipt = await mintTx.wait();
            tokenId = mintReceipt.logs.filter(log => log.fragment && log.fragment.name === 'Transfer')[0].args[2];
            await myNFT.connect(seller).approve(auctionFactory.getAddress(), tokenId);
        });

        it("应成功创建拍卖", async function () {
            await expect(
                auctionFactory.connect(seller).createAuction(
                    myNFT.getAddress(),
                    tokenId,
                    86400,
                    erc20Token.getAddress(),
                    priceFeed.getAddress(),
                    100
                )
            ).to.emit(auctionFactory, "AuctionDeployed"); // 覆盖行 46-50
        });

        it("NFT 未授权应失败", async function () {
            const mintTx = await myNFT.connect(owner).mint(seller.address, "ipfs://test/no_approval");
            const mintReceipt = await mintTx.wait();
            const newTokenId = mintReceipt.logs.filter(log => log.fragment && log.fragment.name === 'Transfer')[0].args[2];
            await expect(
                auctionFactory.connect(seller).createAuction(
                    myNFT.getAddress(),
                    newTokenId,
                    86400,
                    erc20Token.getAddress(),
                    priceFeed.getAddress(),
                    100
                )
            ).to.be.revertedWithCustomError(myNFT, "ERC721InsufficientApproval"); // 修复错误 2
        });

        it("无效持续时间应失败", async function () {
            await expect(
                auctionFactory.connect(seller).createAuction(
                    myNFT.getAddress(),
                    tokenId,
                    0,
                    erc20Token.getAddress(),
                    priceFeed.getAddress(),
                    100
                )
            ).to.be.revertedWith("无效的拍卖持续时间");
        });

        it("无效手续费应失败", async function () {
            await expect(
                auctionFactory.connect(seller).createAuction(
                    myNFT.getAddress(),
                    tokenId,
                    86400,
                    erc20Token.getAddress(),
                    priceFeed.getAddress(),
                    10000
                )
            ).to.be.revertedWith("Invalid fee percentage");
        });

        it("应正确返回所有拍卖", async function () {
            await auctionFactory.connect(seller).createAuction(
                myNFT.getAddress(),
                tokenId,
                86400,
                erc20Token.getAddress(),
                priceFeed.getAddress(),
                100
            );
            const auctions = await auctionFactory.getAuctions();
            expect(auctions.length).to.equal(1);
        });

        it("无效 NFT 地址应失败", async function () {
            await expect(
                auctionFactory.connect(seller).createAuction(
                    ethers.ZeroAddress,
                    tokenId,
                    86400,
                    erc20Token.getAddress(),
                    priceFeed.getAddress(),
                    100
                )
            ).to.be.reverted; // 修复失败 4
        });

        it("无效预言机地址应失败", async function () {
            await expect(
                auctionFactory.connect(seller).createAuction(
                    myNFT.getAddress(),
                    tokenId,
                    86400,
                    erc20Token.getAddress(),
                    ethers.ZeroAddress,
                    100
                )
            ).to.be.revertedWith("无效的价格预言机地址");
        });
    });
});