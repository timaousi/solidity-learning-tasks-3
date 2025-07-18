const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Auction Contract", function () {
    let MyNFT, Auction, MockERC20, MockPriceFeed;
    let myNFT, auction, erc20Token, priceFeed;
    let owner, bidder1, bidder2, seller;

    beforeEach(async function () {
        [owner, bidder1, bidder2, seller] = await ethers.getSigners();

        // 部署 MockERC20
        MockERC20 = await ethers.getContractFactory("MockERC20");
        erc20Token = await MockERC20.deploy("MockToken", "MTK");
        await erc20Token.waitForDeployment();
        await erc20Token.mint(bidder1.address, ethers.parseEther("1000"));
        await erc20Token.mint(bidder2.address, ethers.parseEther("1000"));

        // 部署 MockPriceFeed
        MockPriceFeed = await ethers.getContractFactory("MockV3Aggregator");
        priceFeed = await MockPriceFeed.deploy(8, 2000 * 1e8);
        await priceFeed.waitForDeployment();

        // 部署 MyNFT
        MyNFT = await ethers.getContractFactory("MyNFT");
        myNFT = await MyNFT.deploy();
        await myNFT.waitForDeployment();

        // 部署 Auction 合约
        Auction = await ethers.getContractFactory("Auction");
        const auctionImpl = await Auction.deploy();
        await auctionImpl.waitForDeployment();

        // 部署 NFT 并转移到 Auction 合约
        const tokenId = await myNFT.connect(owner).mint.staticCall(seller.address, "ipfs://test/auction");
        await myNFT.connect(owner).mint(seller.address, "ipfs://test/auction");
        await myNFT.connect(seller).approve(auctionImpl.getAddress(), tokenId);
        await auctionImpl.initialize(
            myNFT.getAddress(),
            tokenId,
            seller.address,
            86400,
            erc20Token.getAddress(),
            priceFeed.getAddress(),
            100
        );
        await myNFT.connect(seller).safeTransferFrom(seller.address, auctionImpl.getAddress(), tokenId);
        auction = auctionImpl;
    });

    describe("Bidding", function () {
        beforeEach(async function () {
            await erc20Token.connect(bidder1).approve(auction.getAddress(), ethers.parseEther("100"));
            await erc20Token.connect(bidder2).approve(auction.getAddress(), ethers.parseEther("100"));
        });

        it("应允许 ETH 出价", async function () {
            await expect(
                auction.connect(bidder1).bidETH({ value: ethers.parseEther("1") })
            ).to.emit(auction, "NewBid").withArgs(bidder1.address, ethers.parseEther("1"), false);
        });

        it("应允许 ERC20 出价", async function () {
            await expect(
                auction.connect(bidder1).bidERC20(ethers.parseEther("2"))
            ).to.emit(auction, "NewBid").withArgs(bidder1.address, ethers.parseEther("2"), true);
        });

        it("卖家出价应失败", async function () {
            await expect(
                auction.connect(seller).bidETH({ value: ethers.parseEther("1") })
            ).to.be.revertedWith("卖家不能出价");
            await expect(
                auction.connect(seller).bidERC20(ethers.parseEther("1"))
            ).to.be.revertedWith("卖家不能出价");
        });

        it("出价低于最高出价应失败", async function () {
            await auction.connect(bidder1).bidETH({ value: ethers.parseEther("2") });
            await expect(
                auction.connect(bidder2).bidETH({ value: ethers.parseEther("1") })
            ).to.be.revertedWith("出价必须高于当前最高出价");
        });

        it("零值出价应失败", async function () {
            await expect(
                auction.connect(bidder1).bidETH({ value: 0 })
            ).to.be.revertedWith("出价金额必须大于零");
            await expect(
                auction.connect(bidder1).bidERC20(0)
            ).to.be.revertedWith("出价金额必须大于零");
        });

        it("ERC20 出价授权不足应失败", async function () {
            await erc20Token.connect(bidder1).approve(auction.getAddress(), 0);
            await expect(
                auction.connect(bidder1).bidERC20(ethers.parseEther("1"))
            ).to.be.revertedWithCustomError(erc20Token, "ERC20InsufficientAllowance");
        });

        it("ERC20 出价余额不足应失败", async function () {
            await erc20Token.connect(bidder1).approve(auction.getAddress(), ethers.parseEther("2000"));
            await erc20Token.connect(bidder1).transfer(owner.address, ethers.parseEther("1000"));
            await expect(
                auction.connect(bidder1).bidERC20(ethers.parseEther("2"))
            ).to.be.revertedWithCustomError(erc20Token, "ERC20InsufficientBalance");
        });

        it("被超出的出价者应收到退款 (ETH 后 ERC20)", async function () {
            const bidder1InitialBalance = await ethers.provider.getBalance(bidder1.address);
            await auction.connect(bidder1).bidETH({ value: ethers.parseEther("1") });
            await auction.connect(bidder2).bidERC20(ethers.parseEther("2"));
            const bidder1FinalBalance = await ethers.provider.getBalance(bidder1.address);
            expect(bidder1FinalBalance).to.be.closeTo(bidder1InitialBalance, ethers.parseEther("0.01"));
        });

        it("被超出的出价者应收到退款 (ERC20 后 ETH)", async function () {
            const bidder1InitialBalance = await erc20Token.balanceOf(bidder1.address);
            await auction.connect(bidder1).bidERC20(ethers.parseEther("1"));
            await auction.connect(bidder2).bidETH({ value: ethers.parseEther("2") });
            const bidder1FinalBalance = await erc20Token.balanceOf(bidder1.address);
            expect(bidder1FinalBalance).to.equal(bidder1InitialBalance);
        });

        it("无效初始化 duration 应失败", async function () {
            const newAuction = await Auction.deploy();
            await newAuction.waitForDeployment();
            const tokenId = await myNFT.connect(owner).mint.staticCall(seller.address, "ipfs://test/new");
            await myNFT.connect(owner).mint(seller.address, "ipfs://test/new");
            await myNFT.connect(seller).approve(newAuction.getAddress(), tokenId);
            await expect(
                newAuction.initialize(
                    myNFT.getAddress(),
                    tokenId,
                    seller.address,
                    0,
                    erc20Token.getAddress(),
                    priceFeed.getAddress(),
                    100
                )
            ).to.be.revertedWith("持续时间无效");
        });

        it("首次 ETH 出价无退款", async function () {
            const bidder1InitialBalance = await ethers.provider.getBalance(bidder1.address);
            await expect(
                auction.connect(bidder1).bidETH({ value: ethers.parseEther("1") })
            ).to.emit(auction, "NewBid").withArgs(bidder1.address, ethers.parseEther("1"), false);
            const bidder1FinalBalance = await ethers.provider.getBalance(bidder1.address);
            const bidAmount = BigInt(ethers.parseEther("1"));
            const gasTolerance = BigInt(ethers.parseEther("0.1"));
            expect(bidder1FinalBalance).to.be.below(bidder1InitialBalance - bidAmount + gasTolerance);
        });

        it("多次 ETH 出价触发退款", async function () {
            const bidder1InitialBalance = await ethers.provider.getBalance(bidder1.address);
            await auction.connect(bidder1).bidETH({ value: ethers.parseEther("1") });
            const bidder1BalanceAfterFirstBid = await ethers.provider.getBalance(bidder1.address);
            await auction.connect(bidder2).bidETH({ value: ethers.parseEther("2") });
            const bidder1FinalBalance = await ethers.provider.getBalance(bidder1.address);
            const expectedRefund = BigInt(ethers.parseEther("1"));
            const gasTolerance = BigInt(ethers.parseEther("0.01"));
            expect(bidder1FinalBalance).to.be.closeTo(bidder1InitialBalance - gasTolerance, ethers.parseEther("0.01")); // 覆盖行 92
        });
    });

    describe("USD Price Conversion", function () {
        it("应正确计算 ETH 出价的美元价值", async function () {
            const usdValue = await auction.getBidUSDValue(ethers.parseEther("1"), false);
            expect(usdValue).to.equal(2000);
        });

        it("应正确计算 ERC20 出价的美元价值", async function () {
            const usdValue = await auction.getBidUSDValue(ethers.parseEther("1"), true);
            expect(usdValue).to.equal(ethers.parseEther("2000"));
        });

        it("价格更新后应反映新美元价值", async function () {
            await priceFeed.updateAnswer(3000 * 1e8);
            const usdValue = await auction.getBidUSDValue(ethers.parseEther("1"), false);
            expect(usdValue).to.equal(3000);
        });

        it("无效价格数据应失败", async function () {
            await priceFeed.updateAnswer(-1000);
            await expect(auction.getBidUSDValue(ethers.parseEther("1"), false))
                .to.be.revertedWith("无效的价格数据");
        });
    });

    describe("Auction Ending", function () {
        it("应正确结束拍卖并转移 NFT 和资金 (ERC20)", async function () {
            await erc20Token.connect(bidder1).approve(auction.getAddress(), ethers.parseEther("100"));
            const bidAmount = ethers.parseEther("10");
            const bidder1InitialBalance = await erc20Token.balanceOf(bidder1.address);
            const sellerInitialBalance = await erc20Token.balanceOf(seller.address);

            await auction.connect(bidder1).bidERC20(bidAmount);
            await ethers.provider.send("evm_increaseTime", [86400]);
            await expect(auction.endAuction())
                .to.emit(auction, "AuctionEnded")
                .withArgs(bidder1.address, bidAmount);

            expect(await myNFT.ownerOf(0)).to.equal(bidder1.address);
            const fee = (bidAmount * BigInt(100)) / BigInt(10000);
            const sellerAmount = bidAmount - fee;
            expect(await erc20Token.balanceOf(seller.address)).to.equal(sellerInitialBalance + sellerAmount);
            expect(await erc20Token.balanceOf(bidder1.address)).to.equal(bidder1InitialBalance - bidAmount);
        });

        it("无出价时 NFT 应返回给卖家", async function () {
            await ethers.provider.send("evm_increaseTime", [86400]);
            await expect(auction.endAuction())
                .to.emit(auction, "AuctionEnded")
                .withArgs(ethers.ZeroAddress, 0);
            expect(await myNFT.ownerOf(0)).to.equal(seller.address);
        });

        it("ETH 出价后应正确结束拍卖", async function () {
            const sellerInitialBalance = await ethers.provider.getBalance(seller.address);
            const bidder1InitialBalance = await ethers.provider.getBalance(bidder1.address);
            const bidAmount = ethers.parseEther("5");
            await auction.connect(bidder1).bidETH({ value: bidAmount });

            await ethers.provider.send("evm_increaseTime", [86400]);
            await expect(auction.endAuction())
                .to.emit(auction, "AuctionEnded")
                .withArgs(bidder1.address, bidAmount);

            expect(await myNFT.ownerOf(0)).to.equal(bidder1.address);
            const fee = (bidAmount * BigInt(100)) / BigInt(10000);
            const sellerAmount = bidAmount - fee;
            const sellerFinalBalance = await ethers.provider.getBalance(seller.address);
            expect(sellerFinalBalance).to.be.closeTo(sellerInitialBalance + sellerAmount, ethers.parseEther("0.01"));
            expect(await ethers.provider.getBalance(bidder1.address)).to.be.below(bidder1InitialBalance - bidAmount);
        });

        it("提前结束拍卖应失败", async function () {
            await expect(auction.endAuction()).to.be.revertedWith("拍卖尚未结束");
        });
    });
});