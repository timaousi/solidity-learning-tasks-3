// SPDX-License-Identifier: MIT
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { upgrades } = require("hardhat");

describe("Auction System", function () {
    let MyNFT, Auction, AuctionFactory, MockPriceFeed, MockERC20;
    let myNFT, auctionFactory, priceFeed, erc20Token;
    let owner, bidder1, bidder2, seller;

    beforeEach(async function () {
        [owner, bidder1, bidder2, seller] = await ethers.getSigners();

        // 部署 Mock 预言机
        MockPriceFeed = await ethers.getContractFactory("MockV3Aggregator");
        priceFeed = await MockPriceFeed.deploy(8, 2000 * 1e8);
        await priceFeed.waitForDeployment();

        // 部署 Mock ERC20
        MockERC20 = await ethers.getContractFactory("MockERC20");
        erc20Token = await MockERC20.deploy("MockToken", "MTK");
        await erc20Token.waitForDeployment();
        await erc20Token.mint(bidder1.address, ethers.parseEther("1000"));
        await erc20Token.mint(bidder2.address, ethers.parseEther("1000"));

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

    describe("MyNFT Contract", function () {
        it("应设置正确的名称和符号", async function () {
            expect(await myNFT.name()).to.equal("MyAuctionNFT");
            expect(await myNFT.symbol()).to.equal("MAUCN");
        });

        it("应将合约所有者设置为部署者", async function () {
            expect(await myNFT.owner()).to.equal(owner.address);
        });

        it("仅限所有者铸造 NFT", async function () {
            await expect(myNFT.connect(owner).mint(bidder1.address, "ipfs://test/1"))
                .to.emit(myNFT, "Transfer")
                .withArgs(ethers.ZeroAddress, bidder1.address, 0);
            await expect(myNFT.connect(bidder1).mint(bidder1.address, "ipfs://test/1"))
                .to.be.revertedWithCustomError(myNFT, "OwnableUnauthorizedAccount")
                .withArgs(bidder1.address);
        });

        it("铸造到零地址应失败", async function () {
            await expect(myNFT.connect(owner).mint(ethers.ZeroAddress, "ipfs://test/1"))
                .to.be.revertedWith("NFT: 接收地址不能为零地址"); // 覆盖行 20
        });

        it("铸造后 NFT 应有正确拥有者和 URI", async function () {
            const tokenId = await myNFT.connect(owner).mint.staticCall(bidder1.address, "ipfs://test/1");
            await myNFT.connect(owner).mint(bidder1.address, "ipfs://test/1");
            expect(await myNFT.ownerOf(tokenId)).to.equal(bidder1.address); // 覆盖行 23
            expect(await myNFT.tokenURI(tokenId)).to.equal("ipfs://test/1"); // 覆盖行 24
            expect(await myNFT.balanceOf(bidder1.address)).to.equal(1);
        });

        it("查询不存在的 tokenId URI 应失败", async function () {
            await expect(myNFT.tokenURI(999))
                .to.be.revertedWithCustomError(myNFT, "ERC721NonexistentToken")
                .withArgs(999); // 覆盖行 21
        });

        it("空 URI 应返回空字符串", async function () {
            const tokenId = await myNFT.connect(owner).mint.staticCall(bidder1.address, "");
            await myNFT.connect(owner).mint(bidder1.address, "");
            expect(await myNFT.tokenURI(tokenId)).to.equal(""); // 覆盖行 29
        });

        it("多次铸造应递增 tokenId", async function () {
            const tokenId1 = await myNFT.connect(owner).mint.staticCall(bidder1.address, "ipfs://test/1");
            await myNFT.connect(owner).mint(bidder1.address, "ipfs://test/1");
            const tokenId2 = await myNFT.connect(owner).mint.staticCall(bidder2.address, "ipfs://test/2");
            await myNFT.connect(owner).mint(bidder2.address, "ipfs://test/2");
            expect(tokenId1).to.equal(0);
            expect(tokenId2).to.equal(1);
            expect(await myNFT.ownerOf(tokenId1)).to.equal(bidder1.address);
            expect(await myNFT.ownerOf(tokenId2)).to.equal(bidder2.address);
            expect(await myNFT.tokenURI(tokenId1)).to.equal("ipfs://test/1");
            expect(await myNFT.tokenURI(tokenId2)).to.equal("ipfs://test/2");
        });

        it("应正确处理 NFT 转移", async function () {
            const tokenId = await myNFT.connect(owner).mint.staticCall(bidder1.address, "ipfs://test/1");
            await myNFT.connect(owner).mint(bidder1.address, "ipfs://test/1");
            await myNFT.connect(bidder1).transferFrom(bidder1.address, bidder2.address, tokenId);
            expect(await myNFT.ownerOf(tokenId)).to.equal(bidder2.address);
            expect(await myNFT.balanceOf(bidder1.address)).to.equal(0);
            expect(await myNFT.balanceOf(bidder2.address)).to.equal(1);
            expect(await myNFT.tokenURI(tokenId)).to.equal("ipfs://test/1"); // 覆盖行 30, 36, 38, 39 (ERC721 内部逻辑)
        });

        it("未授权转移应失败", async function () {
            const tokenId = await myNFT.connect(owner).mint.staticCall(bidder1.address, "ipfs://test/1");
            await myNFT.connect(owner).mint(bidder1.address, "ipfs://test/1");
            await expect(myNFT.connect(bidder2).transferFrom(bidder1.address, bidder2.address, tokenId))
                .to.be.revertedWithCustomError(myNFT, "ERC721InsufficientApproval"); // 覆盖 ERC721 转移逻辑
        });
    });

    describe("MockERC20 Contract", function () {
        it("应正确铸造代币", async function () {
            await erc20Token.mint(bidder1.address, ethers.parseEther("100"));
            expect(await erc20Token.balanceOf(bidder1.address)).to.equal(ethers.parseEther("1100")); // 覆盖行 28
        });

        it("应正确转移代币", async function () {
            await erc20Token.connect(bidder1).transfer(bidder2.address, ethers.parseEther("100"));
            expect(await erc20Token.balanceOf(bidder2.address)).to.equal(ethers.parseEther("1100"));
        });

        it("余额不足时转移应失败", async function () {
            await expect(erc20Token.connect(bidder1).transfer(bidder2.address, ethers.parseEther("2000")))
                .to.be.revertedWithCustomError(erc20Token, "ERC20InsufficientBalance"); // 修复错误 1
        });

        it("应正确授权和转移代币", async function () {
            await erc20Token.connect(bidder1).approve(bidder2.address, ethers.parseEther("100"));
            await erc20Token.connect(bidder2).transferFrom(bidder1.address, bidder2.address, ethers.parseEther("100"));
            expect(await erc20Token.balanceOf(bidder2.address)).to.equal(ethers.parseEther("1100"));
        });
    });

    describe("MockV3Aggregator Contract", function () {
        it("应返回正确的小数位数和价格", async function () {
            expect(await priceFeed.decimals()).to.equal(8);
            const { answer } = await priceFeed.latestRoundData();
            expect(answer).to.equal(2000 * 1e8);
        });

        it("应正确更新价格", async function () {
            await priceFeed.updateAnswer(3000 * 1e8);
            const { answer } = await priceFeed.latestRoundData();
            expect(answer).to.equal(3000 * 1e8); // 覆盖行 101
        });

        it("应正确返回轮次数据", async function () {
            const { roundId, answer, startedAt, updatedAt, answeredInRound } = await priceFeed.getRoundData(1);
            expect(roundId).to.equal(1);
            expect(answer).to.equal(2000 * 1e8);
            expect(startedAt).to.equal(await ethers.provider.getBlock("latest").then(block => block.timestamp));
            expect(answeredInRound).to.equal(1); // 覆盖行 91-93
        });
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
            ).to.be.revertedWith("Invalid duration");
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
    });

    describe("Bidding", function () {
        let auction, auctionAddr, tokenId;

        beforeEach(async function () {
            const mintTx = await myNFT.connect(owner).mint(seller.address, "ipfs://test/bidding");
            const mintReceipt = await mintTx.wait();
            tokenId = mintReceipt.logs.filter(log => log.fragment && log.fragment.name === 'Transfer')[0].args[2];
            await myNFT.connect(seller).approve(auctionFactory.getAddress(), tokenId);

            const tx = await auctionFactory.connect(seller).createAuction(
                myNFT.getAddress(),
                tokenId,
                86400,
                erc20Token.getAddress(),
                priceFeed.getAddress(),
                100
            );
            const receipt = await tx.wait();
            auctionAddr = receipt.logs.filter(log => log.fragment && log.fragment.name === 'AuctionDeployed')[0].args[0];
            auction = Auction.attach(auctionAddr);
            await erc20Token.connect(bidder1).approve(auctionAddr, ethers.parseEther("100"));
            await erc20Token.connect(bidder2).approve(auctionAddr, ethers.parseEther("100"));
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
            ).to.be.revertedWith("卖家不能出价"); // 覆盖行 145
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
            await erc20Token.connect(bidder1).approve(auctionAddr, 0);
            await expect(
                auction.connect(bidder1).bidERC20(ethers.parseEther("1"))
            ).to.be.revertedWithCustomError(erc20Token, "ERC20InsufficientAllowance"); // 修复错误 3
        });

        it("ERC20 出价余额不足应失败", async function () {
            await erc20Token.connect(bidder1).approve(auctionAddr, ethers.parseEther("2000"));
            await erc20Token.connect(bidder1).transfer(owner.address, ethers.parseEther("1000"));
            await expect(
                auction.connect(bidder1).bidERC20(ethers.parseEther("2"))
            ).to.be.revertedWithCustomError(erc20Token, "ERC20InsufficientBalance"); // 修复错误 4
        });

        it("被超出的出价者应收到退款 (ETH 后 ERC20)", async function () {
            const bidder1InitialBalance = await ethers.provider.getBalance(bidder1.address);
            await auction.connect(bidder1).bidETH({ value: ethers.parseEther("1") });
            await auction.connect(bidder2).bidERC20(ethers.parseEther("2"));
            const bidder1FinalBalance = await ethers.provider.getBalance(bidder1.address);
            expect(bidder1FinalBalance).to.be.closeTo(bidder1InitialBalance, ethers.parseEther("0.01")); // 覆盖行 151
        });

        it("被超出的出价者应收到退款 (ERC20 后 ETH)", async function () {
            const bidder1InitialBalance = await erc20Token.balanceOf(bidder1.address);
            await auction.connect(bidder1).bidERC20(ethers.parseEther("1"));
            await auction.connect(bidder2).bidETH({ value: ethers.parseEther("2") });
            expect(await erc20Token.balanceOf(bidder1.address)).to.equal(bidder1InitialBalance); // 覆盖行 148, 149
        });
    });

    describe("USD Price Conversion", function () {
        let auction, auctionAddr, tokenId;

        beforeEach(async function () {
            const mintTx = await myNFT.connect(owner).mint(seller.address, "ipfs://test/usd");
            const mintReceipt = await mintTx.wait();
            tokenId = mintReceipt.logs.filter(log => log.fragment && log.fragment.name === 'Transfer')[0].args[2];
            await myNFT.connect(seller).approve(auctionFactory.getAddress(), tokenId);

            const tx = await auctionFactory.connect(seller).createAuction(
                myNFT.getAddress(),
                tokenId,
                86400,
                erc20Token.getAddress(),
                priceFeed.getAddress(),
                100
            );
            const receipt = await tx.wait();
            auctionAddr = receipt.logs.filter(log => log.fragment && log.fragment.name === 'AuctionDeployed')[0].args[0];
            auction = Auction.attach(auctionAddr);
        });

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
        let auction, auctionAddr, tokenId;

        beforeEach(async function () {
            const mintTx = await myNFT.connect(owner).mint(seller.address, "ipfs://test/auction");
            const mintReceipt = await mintTx.wait();
            tokenId = mintReceipt.logs.filter(log => log.fragment && log.fragment.name === 'Transfer')[0].args[2];
            await myNFT.connect(seller).approve(auctionFactory.getAddress(), tokenId);

            const tx = await auctionFactory.connect(seller).createAuction(
                myNFT.getAddress(),
                tokenId,
                86400,
                erc20Token.getAddress(),
                priceFeed.getAddress(),
                100
            );
            const receipt = await tx.wait();
            auctionAddr = receipt.logs.filter(log => log.fragment && log.fragment.name === 'AuctionDeployed')[0].args[0];
            auction = Auction.attach(auctionAddr);
        });

        it("应正确结束拍卖并转移 NFT 和资金 (ERC20)", async function () {
            await erc20Token.connect(bidder1).approve(auctionAddr, ethers.parseEther("100"));
            const bidAmount = ethers.parseEther("10");
            const bidder1InitialBalance = await erc20Token.balanceOf(bidder1.address);
            const sellerInitialBalance = await erc20Token.balanceOf(seller.address);

            await auction.connect(bidder1).bidERC20(bidAmount);
            await ethers.provider.send("evm_increaseTime", [86400]);
            await expect(auction.endAuction())
                .to.emit(auction, "AuctionEnded")
                .withArgs(bidder1.address, bidAmount);

            expect(await myNFT.ownerOf(tokenId)).to.equal(bidder1.address);
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
            expect(await myNFT.ownerOf(tokenId)).to.equal(seller.address); // 覆盖 Auction.sol 可能的转移逻辑
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

            expect(await myNFT.ownerOf(tokenId)).to.equal(bidder1.address);
            const fee = (bidAmount * BigInt(100)) / BigInt(10000);
            const sellerAmount = bidAmount - fee;
            const sellerFinalBalance = await ethers.provider.getBalance(seller.address);
            expect(sellerFinalBalance).to.be.closeTo(sellerInitialBalance + sellerAmount, ethers.parseEther("0.01"));
            expect(await ethers.provider.getBalance(bidder1.address)).to.be.below(bidder1InitialBalance - bidAmount);
        });

        it("提前结束拍卖应失败", async function () {
            await expect(auction.endAuction()).to.be.revertedWith("拍卖尚未结束");
        });

        it("无效初始化参数应失败", async function () {
            const mintTx = await myNFT.connect(owner).mint(seller.address, "ipfs://test/invalid_init");
            const mintReceipt = await mintTx.wait();
            const newTokenId = mintReceipt.logs.filter(log => log.fragment && log.fragment.name === 'Transfer')[0].args[2];
            await myNFT.connect(seller).approve(auctionFactory.getAddress(), newTokenId);

            // 测试无效 NFT 地址
            await expect(
                auctionFactory.connect(seller).createAuction(
                    ethers.ZeroAddress,
                    newTokenId,
                    86400,
                    erc20Token.getAddress(),
                    priceFeed.getAddress(),
                    100
                )
            ).to.be.revertedWith("Invalid NFT contract address"); // 假设 AuctionFactory 有此检查

            // 测试无效预言机地址
            await expect(
                auctionFactory.connect(seller).createAuction(
                    myNFT.getAddress(),
                    newTokenId,
                    86400,
                    erc20Token.getAddress(),
                    ethers.ZeroAddress,
                    100
                )
            ).to.be.revertedWith("Invalid price feed address"); // 假设 AuctionFactory 有此检查
            // 覆盖 Auction.sol 可能的行 70
        });
    });
});