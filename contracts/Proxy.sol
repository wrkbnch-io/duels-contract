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

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DuelsProxy is ERC1967Proxy {
  constructor(address _logic, bytes memory _data) ERC1967Proxy(_logic, _data) {}
}
