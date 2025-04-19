// Duels is a solidity smart contract that accepts
// ERC20 tokens in order to play a game. More detailed
// information can be found in the README.md file.
//
// Copyright (C) 2025  Artemii Fedotov
// Repository: https://github.com/wrkbnch-io/duels-contract
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

import {
  impersonateAccount,
  loadFixture,
  time,
} from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

enum Status {
  AwaitingGuest,
  WithdrawAvailable,
  Withdrawn,
}

describe('DuelsContract', () => {
  async function deployDuelsContractFixture() {
    const [owner, host, guest, other] = await ethers.getSigners();

    // arb mainnet
    const whales = {
      USDC: '0xa4F76156a31A46E1D409E4b7818161370A09f2Cb',
      UNI: '0x814185bB33e787a638dFb27F551CF70333FB6412',
      SUSHI: '0xe4b44B74Cfe3615b1E4b9FE158C546121e76dF72',
    };

    // arb mainnet
    const erc20MainnetAddresses = {
      USDC: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
      UNI: '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0',
      SUSHI: '0xd4d42F0b6DEF4CE0383636770eF773390d85c61A',
    };

    await impersonateAccount(whales.SUSHI);
    const whale = await ethers.getSigner(whales.SUSHI);
    const token = await ethers.getContractAt(
      'IERC20',
      erc20MainnetAddresses.SUSHI
    );

    try {
      await token
        .connect(whale)
        .transfer(host.address, (await token.balanceOf(whale.address)) / 2n);

      await token
        .connect(whale)
        .transfer(guest.address, await token.balanceOf(whale.address));
    } catch (e) {
      console.error(e);
    }

    const minAmount = ethers.parseEther('2');

    const DuelsContract = await ethers.getContractFactory('DuelsContract');
    const duelsContract = await DuelsContract.deploy(
      erc20MainnetAddresses.SUSHI,
      minAmount
    );

    return { duelsContract, owner, token, host, guest, other };
  }

  const createDuel = async (betAmount?: number) => {
    const { duelsContract, token, host } = await loadFixture(
      deployDuelsContractFixture
    );
    const amount = ethers.parseEther(betAmount?.toString() || '100');
    await token.connect(host).approve(duelsContract.getAddress(), amount);
    await duelsContract.connect(host).create(amount);

    const count = await duelsContract.duelsCount();
    expect(count).to.be.greaterThan(0);

    const duel = await duelsContract.duels(Number(count) - 1);
    expect(duel.host).to.equal(host.address);
    expect(duel.hostStake).to.equal(amount);
    expect(duel.winner).to.equal(ethers.ZeroAddress);
    expect(duel.status).to.equal(Status.AwaitingGuest);
    expect(duel.guest).to.equal(ethers.ZeroAddress);
    expect(duel.guestStake).to.equal(0);
    expect(duel.pool).to.equal(amount);
  };

  describe('Deployment', () => {
    it('Should set the right owner', async () => {
      const { duelsContract, owner } = await loadFixture(
        deployDuelsContractFixture
      );
      expect(await duelsContract.owner()).to.equal(
        owner.address,
        'Owner should be correct'
      );
    });

    it('Should set the right token address', async () => {
      const { duelsContract, token } = await loadFixture(
        deployDuelsContractFixture
      );
      expect(await duelsContract.token()).to.equal(
        await token.getAddress(),
        'Token should be correct'
      );
    });

    it('Should revert if token address is zero', async () => {
      const DuelsContract = await ethers.getContractFactory('DuelsContract');
      await expect(
        DuelsContract.deploy(ethers.ZeroAddress, 0)
      ).to.be.revertedWith('Invalid token');
    });

    it('Should revert if min amount is zero', async () => {
      const DuelsContract = await ethers.getContractFactory('DuelsContract');
      await expect(
        DuelsContract.deploy('0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0', 0)
      ).to.be.revertedWith('Invalid min amount');
    });
  });

  describe('create()', () => {
    it('Should create a new duel', async () => {
      const { duelsContract, token, host } = await loadFixture(
        deployDuelsContractFixture
      );
      const hostInitialBalance = await token.balanceOf(host.address);

      const amount = ethers.parseEther('2');
      await token.connect(host).approve(duelsContract.getAddress(), amount);
      await duelsContract.connect(host).create(amount);

      const duel = await duelsContract.duels(0);
      const count = await duelsContract.duelsCount();

      expect(hostInitialBalance).to.greaterThan(
        await token.balanceOf(host.address),
        'Host balance should be reduced'
      );

      expect(count).to.equal(1, 'Duel count should be increased');
      expect(duel.host).to.equal(host.address, 'Host should be set');
      expect(duel.hostStake).to.equal(amount, 'Host stake should be set');
      expect(duel.winner).to.equal(
        ethers.ZeroAddress,
        'Winner should be zero address'
      );
      expect(duel.status).to.equal(
        Status.AwaitingGuest,
        'Status should be AwaitingGuest'
      );
      expect(duel.guest).to.equal(
        ethers.ZeroAddress,
        'Guest should be zero address'
      );
      expect(duel.guestStake).to.equal(0, 'Guest stake should be zero');
      expect(duel.pool).to.equal(amount, 'Pool should be set');
    });

    it('Should revert if amount is less than MIN_AMOUNT', async () => {
      const { duelsContract, token, host } = await loadFixture(
        deployDuelsContractFixture
      );
      const amount = ethers.parseEther('1');
      await token.connect(host).approve(duelsContract.getAddress(), amount);
      await expect(
        duelsContract.connect(host).create(amount)
      ).to.be.revertedWith('Invalid initial bet');
    });

    it('Should revert if invalid balance', async () => {
      const { duelsContract, token, other } = await loadFixture(
        deployDuelsContractFixture
      );
      const amount = ethers.parseEther('2');
      await token.connect(other).approve(duelsContract.getAddress(), amount);
      await expect(
        duelsContract.connect(other).create(amount)
      ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
    });
  });

  describe('join()', () => {
    it('Should allow guest to join with bet in higher bound', async () => {
      const { duelsContract, token, guest } = await loadFixture(
        deployDuelsContractFixture
      );

      await createDuel();

      const amount = ethers.parseEther('130');
      await token.connect(guest).approve(duelsContract.getAddress(), amount);
      await duelsContract.connect(guest).join(0, amount);

      const duel = await duelsContract.duels(0);

      expect(duel.guest).to.equal(guest.address, 'Guest should be set');
      expect(duel.guestStake).to.equal(amount, 'Guest stake should be set');
      expect(duel.pool).to.equal(
        ethers.parseEther('230'),
        'Pool should be set'
      );
      expect(duel.status).to.equal(
        Status.WithdrawAvailable,
        'Status should be WithdrawAvailable'
      );
      expect(duel.winner).to.not.equal(
        ethers.ZeroAddress,
        'Winner should be set'
      );
    });

    it('Should allow guest to join with bet in lower bound', async () => {
      const { duelsContract, token, guest } = await loadFixture(
        deployDuelsContractFixture
      );

      await createDuel();

      const amount = ethers.parseEther('70');
      await token.connect(guest).approve(duelsContract.getAddress(), amount);
      await duelsContract.connect(guest).join(0, amount);

      const duel = await duelsContract.duels(0);

      expect(duel.guest).to.equal(guest.address, 'Guest should be set');
      expect(duel.guestStake).to.equal(amount, 'Guest stake should be set');
      expect(duel.pool).to.equal(
        ethers.parseEther('170'),
        'Pool should be set'
      );
      expect(duel.status).to.equal(
        Status.WithdrawAvailable,
        'Status should be WithdrawAvailable'
      );
      expect(duel.winner).to.not.equal(
        ethers.ZeroAddress,
        'Winner should be set'
      );
    });

    it('Should accept minimal amount as lower bound', async () => {
      const { duelsContract, token, guest } = await loadFixture(
        deployDuelsContractFixture
      );

      await createDuel(2.58);

      const amount = ethers.parseEther('2');
      await token.connect(guest).approve(duelsContract.getAddress(), amount);
      await expect(duelsContract.connect(guest).join(0, amount)).not.to.be
        .reverted;

      const duel = await duelsContract.duels(0);
      expect(duel.guest).to.equal(guest.address, 'Guest should be set');
      expect(duel.guestStake).to.equal(amount, 'Guest stake should be set');
      expect(duel.pool).to.equal(
        ethers.parseEther('4.58'),
        'Pool should be set'
      );
      expect(duel.status).to.equal(
        Status.WithdrawAvailable,
        'Status should be WithdrawAvailable'
      );
      expect(duel.winner).to.not.equal(
        ethers.ZeroAddress,
        'Winner should be set'
      );
    });

    it('Should revert lower bound bet if it is less than MIN_AMOUNT', async () => {
      const { duelsContract, token, guest } = await loadFixture(
        deployDuelsContractFixture
      );

      await createDuel(2);

      const amount = ethers.parseEther('1.98');
      await token.connect(guest).approve(duelsContract.getAddress(), amount);
      await expect(
        duelsContract.connect(guest).join(0, amount)
      ).to.be.revertedWith(
        'Initial bet must be within the allowed range of initial bet and greater or equal to min amount'
      );
    });

    it('Should if bet is out of allowed range', async () => {
      const { duelsContract, token, guest } = await loadFixture(
        deployDuelsContractFixture
      );

      await createDuel(4);

      const amount = ethers.parseEther('5.200001');
      await token.connect(guest).approve(duelsContract.getAddress(), amount);
      await expect(
        duelsContract.connect(guest).join(0, amount)
      ).to.be.revertedWith(
        'Initial bet must be within the allowed range of initial bet and greater or equal to min amount'
      );
    });

    it('Should revert if host tries to join as guest', async () => {
      const { duelsContract, token, host } = await loadFixture(
        deployDuelsContractFixture
      );

      await createDuel();

      const amount = ethers.parseEther('70');
      await token.connect(host).approve(duelsContract.getAddress(), amount);
      await expect(
        duelsContract.connect(host).join(0, amount)
      ).to.be.revertedWith('Host cannot join as guest');
    });

    it('Should revert if duel is already played', async () => {
      const { duelsContract, token, guest } = await loadFixture(
        deployDuelsContractFixture
      );

      await createDuel();

      const amount = ethers.parseEther('70');
      await token.connect(guest).approve(duelsContract.getAddress(), amount);
      await duelsContract.connect(guest).join(0, amount);

      await expect(
        duelsContract.connect(guest).join(0, amount)
      ).to.be.revertedWith('Duel is already played');
    });

    it('Should revert if duel is expired', async () => {
      const { duelsContract, token, guest } = await loadFixture(
        deployDuelsContractFixture
      );

      await createDuel();

      await time.increase(43_200);

      const amount = ethers.parseEther('70');
      await token.connect(guest).approve(duelsContract.getAddress(), amount);
      await expect(
        duelsContract.connect(guest).join(0, amount)
      ).to.be.revertedWith('Duel is expired');
    });
  });

  describe('withdraw()', () => {
    const playGame = async () => {
      const { duelsContract, token, host, guest } = await loadFixture(
        deployDuelsContractFixture
      );
      const amount = ethers.parseEther('2');
      await token.connect(host).approve(duelsContract.getAddress(), amount);
      await duelsContract.connect(host).create(amount);

      await token.connect(guest).approve(duelsContract.getAddress(), amount);
      await duelsContract.connect(guest).join(0, amount);

      const duel = await duelsContract.duels(0);

      expect(duel.guest).to.equal(guest.address);
      expect(duel.guestStake).to.equal(amount);
      expect(duel.pool).to.equal(ethers.parseEther('4'));
      expect(duel.status).to.equal(Status.WithdrawAvailable);
      expect(duel.winner).to.not.equal(ethers.ZeroAddress);

      return duel.winner === host.address
        ? { winner: host, loser: guest }
        : { winner: guest, loser: host };
    };

    it('Should allow winner to withdraw', async () => {
      const { duelsContract, token, owner } = await loadFixture(
        deployDuelsContractFixture
      );
      const { winner } = await playGame();
      const ownerBalanceBefore = await token.balanceOf(owner.address);
      const winnerBalanceBefore = await token.balanceOf(winner.address);
      await expect(duelsContract.connect(winner).withdraw(0)).to.not.be
        .reverted;

      const ownerBalanceAfter = await token.balanceOf(owner.address);
      const winnerBalanceAfter = await token.balanceOf(winner.address);
      const duelAfter = await duelsContract.duels(0);

      expect(ownerBalanceAfter).to.be.greaterThan(
        ownerBalanceBefore,
        "Owner's balance should be greater than before"
      );
      expect(winnerBalanceAfter).to.be.greaterThan(
        winnerBalanceBefore,
        "Winner's balance should be greater than before"
      );
      expect(duelAfter.pool).to.equal(0, 'Pool should be empty');
      expect(duelAfter.status).to.equal(
        Status.Withdrawn,
        'Duel should be withdrawn'
      );
    });

    it('Should revert if called by non-winner', async () => {
      const { duelsContract, token } = await loadFixture(
        deployDuelsContractFixture
      );
      const { winner, loser } = await playGame();
      const loserBalanceBefore = await token.balanceOf(loser.address);
      const winnerBalanceBefore = await token.balanceOf(winner.address);

      await expect(duelsContract.connect(loser).withdraw(0)).to.be.revertedWith(
        'Only the winner can withdraw'
      );

      const winnerBalanceAfter = await token.balanceOf(winner.address);
      const loserBalanceAfter = await token.balanceOf(loser.address);
      const duelAfter = await duelsContract.duels(0);

      expect(winnerBalanceAfter).to.equal(
        winnerBalanceBefore,
        "Winner's balance shouldn't change"
      );
      expect(loserBalanceAfter).to.equal(
        loserBalanceBefore,
        "Loser's balance shouldn't change"
      );
      expect(duelAfter.pool).to.not.equal(0, "Pool shouldn't be empty");
      expect(duelAfter.status).to.not.equal(
        Status.Withdrawn,
        "Duel shouldn't be withdrawn"
      );
    });
  });

  describe('expire()', () => {
    it('Should allow owner to expire duel', async () => {
      const { duelsContract } = await loadFixture(deployDuelsContractFixture);
      await createDuel();
      await time.increase(43_200);
      await expect(duelsContract.expire(0)).to.not.be.reverted;
    });

    it('Should revert if called by non-owner', async () => {
      const { duelsContract, guest } = await loadFixture(
        deployDuelsContractFixture
      );
      await createDuel(2);

      await expect(duelsContract.connect(guest).expire(0)).to.be.revertedWith(
        'Only owner can expire duels'
      );
    });

    it('Should revert if duel is not expired', async () => {
      const { duelsContract } = await loadFixture(deployDuelsContractFixture);
      await createDuel();
      await time.increase(43_198);
      await expect(duelsContract.expire(0)).to.be.revertedWith(
        'Duel is not expired yet'
      );
    });

    it('Should revert if duel is not in AwaitingGuest status', async () => {
      const { duelsContract, token, guest } = await loadFixture(
        deployDuelsContractFixture
      );
      await createDuel(2);
      await time.increase(43_000);

      const amount = ethers.parseEther('2');
      await token.connect(guest).approve(duelsContract.getAddress(), amount);
      await duelsContract.connect(guest).join(0, amount);

      await expect(duelsContract.expire(0)).to.be.revertedWith(
        'Duel is not expired'
      );
    });
  });
});
