// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Duels is a solidity smart contract that accepts
// ERC20 tokens in order to play a game. More detailed
// information can be found in the README.md file.
//
// Copyright (C) 2025  Artemii Fedotov
// Repository: https://github.com/wrkbnch-io/duels-contract
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract DuelsContract is ReentrancyGuard {
  using SafeERC20 for IERC20;

  enum Status {
    AwaitingGuest,
    WithdrawAvailable,
    Withdrawn
  }

  struct Duel {
    address host;
    uint256 hostStake;

    address guest;
    uint256 guestStake;

    uint256 pool;
    address winner;

    uint256 createdAt;
    uint256 expiresAt;
    Status status;
  }

  mapping(uint256 => Duel) public duels;

  address public owner;
  uint256 private minAmount;
  uint256 public duelsCount = 0;
  uint256 constant EXPIRATION_PERIOD = 12 hours;
  uint8 constant PLATFORM_FEE = 10;
  uint8 constant BET_RANGE = 30;

  IERC20 public token;

  event DuelCreated(uint256 id, Duel duel);
  event DuelPlayed(uint256 id, Duel duel, address winner);
  event ReturnHostFunds(uint256 id, Duel duel);
  event DuelWithdrawn(uint256 id, Duel duel);

  constructor(address _token, uint256 _minAmount) {
    require(_token != address(0), "Invalid token");
    require(_minAmount > 0, "Invalid min amount");
    owner = msg.sender;
    token = IERC20(_token);
    minAmount = _minAmount;
  }

  function defineWinner(uint256 _betUser1, uint256 _betUser2) private view returns (uint8) {
    uint _chanceForOne = (_betUser1 * 100) / (_betUser1 + _betUser2);
    uint _random = uint(keccak256(
      abi.encodePacked(block.timestamp, block.prevrandao, msg.sender))) % 100;
    return _random < _chanceForOne ? 1 : 2;
  }

  function create(uint256 amount) external nonReentrant {
    require(amount >= minAmount, "Invalid initial bet");

    token.safeTransferFrom(msg.sender, address(this), amount);

    duels[duelsCount] = Duel({
      host: msg.sender,
      hostStake: amount,
      guest: address(0),
      guestStake: 0,
      pool: amount,
      winner: address(0),
      createdAt: block.timestamp,
      expiresAt: block.timestamp + EXPIRATION_PERIOD,
      status: Status.AwaitingGuest
    });

    duelsCount += 1;
    emit DuelCreated(duelsCount - 1, duels[duelsCount - 1]);
  }

  function join(uint256 _id, uint256 amount) external nonReentrant {
    Duel storage duel = duels[_id];

    require(msg.sender != duel.host, "Host cannot join as guest");
    require(duel.guest == address(0), "Duel is already played");
    require(duel.winner == address(0), "Duel is already played");
    require(duel.status == Status.AwaitingGuest, "Duel is already played");

    if (block.timestamp > duel.expiresAt) {
      emit ReturnHostFunds(_id, duel);
      revert("Duel is expired");
    }

    uint256 _hostStake = duel.hostStake;
    uint256 _upperBound = _hostStake + (_hostStake * BET_RANGE / 100);
    uint256 _lowerBound = _hostStake - (_hostStake * BET_RANGE / 100);
    if (_lowerBound < minAmount) _lowerBound = minAmount;

    require(amount >= _lowerBound && amount <= _upperBound, 
      "Initial bet must be within the allowed range of initial bet and greater or equal to min amount");

    token.safeTransferFrom(msg.sender, address(this), amount);

    duel.guest = msg.sender;
    duel.guestStake = amount;
    duel.pool += amount;

    uint8 winner = defineWinner(duel.hostStake, duel.guestStake);
    duel.winner = winner == 1 ? duel.host : duel.guest;
    duel.status = Status.WithdrawAvailable;

    emit DuelPlayed(_id, duels[_id], duels[_id].winner);
  }

  function withdraw(uint256 _id) external nonReentrant {
    Duel storage duel = duels[_id];

    require(duel.winner == msg.sender, "Only the winner can withdraw");
    require(duel.pool > 0, "Duel has no pool");
    require(duel.status == Status.WithdrawAvailable, "Withdraw is not available");

    uint256 _pool = duel.pool;
    uint256 _platformFee = _pool * PLATFORM_FEE / 100;

    // Transfer winnings to winner (minus fee)
    token.safeTransfer(duel.winner, _pool - _platformFee);
    // Transfer fee to owner
    token.safeTransfer(owner, _platformFee);

    duel.pool = 0;
    duel.status = Status.Withdrawn;

    emit DuelWithdrawn(_id, duel);
  }

  function expire(uint256 _id) external {
    Duel storage duel = duels[_id];
    require(msg.sender == owner, "Only owner can expire duels");
    require(duel.status == Status.AwaitingGuest, "Duel is not expired");
    require(block.timestamp > duel.expiresAt, "Duel is not expired yet");

    duel.status = Status.Withdrawn;
    // Return tokens to host
    token.safeTransfer(duel.host, duel.pool);
  }
}
