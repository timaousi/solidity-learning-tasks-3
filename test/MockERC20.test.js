// SPDX-License-Identifier: MIT
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MockERC20 Contract", function () {
    let MockERC20, erc20Token;
    let owner, user1, user2;

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();
        MockERC20 = await ethers.getContractFactory("MockERC20");
        erc20Token = await MockERC20.deploy("MockToken", "MTK");
        await erc20Token.waitForDeployment();
    });

    it("应设置正确的名称和符号", async function () {
        expect(await erc20Token.name()).to.equal("MockToken");
        expect(await erc20Token.symbol()).to.equal("MTK");
    });

    it("应正确铸造代币", async function () {
        await erc20Token.mint(user1.address, ethers.parseEther("100"));
        expect(await erc20Token.balanceOf(user1.address)).to.equal(ethers.parseEther("100")); // 覆盖行 28
        expect(await erc20Token.totalSupply()).to.equal(ethers.parseEther("100"));
        await expect(erc20Token.mint(user1.address, ethers.parseEther("50")))
            .to.emit(erc20Token, "Transfer")
            .withArgs(ethers.ZeroAddress, user1.address, ethers.parseEther("50"));
    });

    it("应正确转移代币", async function () {
        await erc20Token.mint(user1.address, ethers.parseEther("100"));
        await erc20Token.connect(user1).transfer(user2.address, ethers.parseEther("50"));
        expect(await erc20Token.balanceOf(user1.address)).to.equal(ethers.parseEther("50"));
        expect(await erc20Token.balanceOf(user2.address)).to.equal(ethers.parseEther("50"));
        await expect(erc20Token.connect(user1).transfer(user2.address, ethers.parseEther("50")))
            .to.emit(erc20Token, "Transfer")
            .withArgs(user1.address, user2.address, ethers.parseEther("50"));
    });

    it("余额不足时转移应失败", async function () {
        await erc20Token.mint(user1.address, ethers.parseEther("100"));
        await expect(erc20Token.connect(user1).transfer(user2.address, ethers.parseEther("200")))
            .to.be.revertedWithCustomError(erc20Token, "ERC20InsufficientBalance")
            .withArgs(user1.address, ethers.parseEther("100"), ethers.parseEther("200")); // 修复错误 1
    });

    it("应正确授权和转移代币", async function () {
        await erc20Token.mint(user1.address, ethers.parseEther("100"));
        await erc20Token.connect(user1).approve(user2.address, ethers.parseEther("50"));
        expect(await erc20Token.allowance(user1.address, user2.address)).to.equal(ethers.parseEther("50"));
        await erc20Token.connect(user2).transferFrom(user1.address, user2.address, ethers.parseEther("50"));
        expect(await erc20Token.balanceOf(user1.address)).to.equal(ethers.parseEther("50"));
        expect(await erc20Token.balanceOf(user2.address)).to.equal(ethers.parseEther("50"));
        await erc20Token.connect(user1).approve(user2.address, ethers.parseEther("50")); // 修复失败 6
        await expect(erc20Token.connect(user2).transferFrom(user1.address, user2.address, ethers.parseEther("50")))
            .to.emit(erc20Token, "Transfer")
            .withArgs(user1.address, user2.address, ethers.parseEther("50"));
    });

    it("授权不足时转移应失败", async function () {
        await erc20Token.mint(user1.address, ethers.parseEther("100"));
        await erc20Token.connect(user1).approve(user2.address, ethers.parseEther("10"));
        await expect(erc20Token.connect(user2).transferFrom(user1.address, user2.address, ethers.parseEther("50")))
            .to.be.revertedWithCustomError(erc20Token, "ERC20InsufficientAllowance")
            .withArgs(user2.address, ethers.parseEther("10"), ethers.parseEther("50")); // 修复错误 3
    });
});