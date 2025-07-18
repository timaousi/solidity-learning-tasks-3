// SPDX-License-Identifier: MIT
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MyNFT Contract", function () {
    let MyNFT, myNFT;
    let owner, user1, user2;

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();
        MyNFT = await ethers.getContractFactory("MyNFT");
        myNFT = await MyNFT.deploy();
        await myNFT.waitForDeployment();
    });

    it("应设置正确的名称和符号", async function () {
        expect(await myNFT.name()).to.equal("MyAuctionNFT");
        expect(await myNFT.symbol()).to.equal("MAUCN");
    });

    it("应将合约所有者设置为部署者", async function () {
        expect(await myNFT.owner()).to.equal(owner.address);
    });

    it("仅限所有者铸造 NFT", async function () {
        await expect(myNFT.connect(owner).mint(user1.address, "ipfs://test/1"))
            .to.emit(myNFT, "Transfer")
            .withArgs(ethers.ZeroAddress, user1.address, 0);
        await expect(myNFT.connect(user1).mint(user1.address, "ipfs://test/1"))
            .to.be.revertedWithCustomError(myNFT, "OwnableUnauthorizedAccount")
            .withArgs(user1.address);
    });

    it("铸造到零地址应失败", async function () {
        await expect(myNFT.connect(owner).mint(ethers.ZeroAddress, "ipfs://test/1"))
            .to.be.revertedWith("NFT: 接收地址不能为零地址"); // 覆盖行 20
    });

    it("铸造后 NFT 应有正确拥有者和 URI", async function () {
        const tokenId = await myNFT.connect(owner).mint.staticCall(user1.address, "ipfs://test/1");
        await myNFT.connect(owner).mint(user1.address, "ipfs://test/1");
        expect(await myNFT.ownerOf(tokenId)).to.equal(user1.address); // 覆盖行 23
        expect(await myNFT.tokenURI(tokenId)).to.equal("ipfs://test/1"); // 覆盖行 24
        expect(await myNFT.balanceOf(user1.address)).to.equal(1);
    });

    it("查询不存在的 tokenId URI 应失败", async function () {
        await expect(myNFT.tokenURI(999))
            .to.be.revertedWith("ERC721Metadata: 查询不存在的代币URI");
    });

    it("空 URI 应返回空字符串", async function () {
        const tokenId = await myNFT.connect(owner).mint.staticCall(user1.address, "");
        await myNFT.connect(owner).mint(user1.address, "");
        expect(await myNFT.tokenURI(tokenId)).to.equal(""); // 覆盖行 29
    });

    it("多次铸造应递增 tokenId", async function () {
        const tokenId1 = await myNFT.connect(owner).mint.staticCall(user1.address, "ipfs://test/1");
        await myNFT.connect(owner).mint(user1.address, "ipfs://test/1");
        const tokenId2 = await myNFT.connect(owner).mint.staticCall(user2.address, "ipfs://test/2");
        await myNFT.connect(owner).mint(user2.address, "ipfs://test/2");
        expect(tokenId1).to.equal(0);
        expect(tokenId2).to.equal(1);
        expect(await myNFT.ownerOf(tokenId1)).to.equal(user1.address);
        expect(await myNFT.ownerOf(tokenId2)).to.equal(user2.address);
        expect(await myNFT.tokenURI(tokenId1)).to.equal("ipfs://test/1");
        expect(await myNFT.tokenURI(tokenId2)).to.equal("ipfs://test/2");
    });

    it("应正确处理 NFT 转移", async function () {
        const tokenId = await myNFT.connect(owner).mint.staticCall(user1.address, "ipfs://test/1");
        await myNFT.connect(owner).mint(user1.address, "ipfs://test/1");
        await myNFT.connect(user1).transferFrom(user1.address, user2.address, tokenId);
        expect(await myNFT.ownerOf(tokenId)).to.equal(user2.address);
        expect(await myNFT.balanceOf(user1.address)).to.equal(0);
        expect(await myNFT.balanceOf(user2.address)).to.equal(1);
        expect(await myNFT.tokenURI(tokenId)).to.equal("ipfs://test/1"); // 覆盖行 30, 36, 38, 39
    });

    it("未授权转移应失败", async function () {
        const tokenId = await myNFT.connect(owner).mint.staticCall(user1.address, "ipfs://test/1");
        await myNFT.connect(owner).mint(user1.address, "ipfs://test/1");
        await expect(myNFT.connect(user2).transferFrom(user1.address, user2.address, tokenId))
            .to.be.revertedWithCustomError(myNFT, "ERC721InsufficientApproval"); // 覆盖错误 2
    });

    it("应正确设置和验证授权", async function () {
        const tokenId = await myNFT.connect(owner).mint.staticCall(user1.address, "ipfs://test/1");
        await myNFT.connect(owner).mint(user1.address, "ipfs://test/1");
        await myNFT.connect(user1).approve(user2.address, tokenId);
        expect(await myNFT.getApproved(tokenId)).to.equal(user2.address);
        await myNFT.connect(user2).transferFrom(user1.address, user2.address, tokenId);
        expect(await myNFT.ownerOf(tokenId)).to.equal(user2.address); // 覆盖行 36, 38, 39
    });

    it("应正确设置和验证全局授权", async function () {
        const tokenId = await myNFT.connect(owner).mint.staticCall(user1.address, "ipfs://test/1");
        await myNFT.connect(owner).mint(user1.address, "ipfs://test/1");
        await myNFT.connect(user1).setApprovalForAll(user2.address, true);
        expect(await myNFT.isApprovedForAll(user1.address, user2.address)).to.be.true;
        await myNFT.connect(user2).transferFrom(user1.address, user2.address, tokenId);
        expect(await myNFT.ownerOf(tokenId)).to.equal(user2.address); // 覆盖行 36, 38, 39
    });
});