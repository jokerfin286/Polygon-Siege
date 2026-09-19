import assert from 'node:assert/strict';
import { Bus, makeCode, PEER_COLORS } from '../src/net/net';

async function testMultiplayer() {
  console.log('Testing Global Internet Multiplayer over WebSocket...');
  const code = makeCode();
  console.log('Test Room Code:', code);

  let hostReceivedJoin = false;
  let guestReceivedRoster = false;
  let allReadyHandshake = false;
  let guestHitProcessed = false;
  let levelUpSync = false;
  let reviveTriggered = false;

  const hostBus = new Bus(code);
  const guestBus = new Bus(code);

  // Host listener
  hostBus.on((msg) => {
    if (msg.type === 'join') {
      hostReceivedJoin = true;
      hostBus.send('joined', {
        to: msg.from,
        code,
        peers: [
          { id: hostBus.id, name: 'HostPlayer', ready: true, host: true, color: PEER_COLORS[0], shape: 'circle' },
          { id: msg.from, name: msg.name, ready: false, host: false, color: PEER_COLORS[1], shape: 'square' },
        ],
      });
    } else if (msg.type === 'ready') {
      allReadyHandshake = true;
      hostBus.send('startCountdown', { seconds: 3 });
    } else if (msg.type === 'enemyHit') {
      guestHitProcessed = true;
      assert.equal(msg.dmg, 25);
      assert.equal(msg.id, 99);
      hostBus.send('enemyDamaged', { id: msg.id, newHp: 75 });
    } else if (msg.type === 'levelUpRequest') {
      levelUpSync = true;
      assert.equal(msg.name, 'GuestPlayer');
      hostBus.send('pauseForLevelUp', { who: msg.who, name: msg.name, choices: msg.choices });
    } else if (msg.type === 'bossKilled') {
      reviveTriggered = true;
      hostBus.send('revivePartners', { duration: 3 });
    }
  });

  // Guest listener
  guestBus.on((msg) => {
    if (msg.type === 'joined' && msg.to === guestBus.id) {
      guestReceivedRoster = true;
      guestBus.send('ready', { code, ready: true });
    } else if (msg.type === 'startCountdown') {
      // Game started! Guest sends hit on enemy
      setTimeout(() => {
        guestBus.send('enemyHit', { id: 99, dmg: 25, crit: false, kx: 10, ky: 0 });
      }, 300);
    } else if (msg.type === 'enemyDamaged') {
      // Enemy took damage! Guest triggers level-up
      setTimeout(() => {
        guestBus.send('levelUpRequest', {
          who: guestBus.id,
          name: 'GuestPlayer',
          choices: [{ key: 'dmg:1', def: { id: 'dmg', name: 'Damage Amp', rarity: 1 }, level: 1 }],
        });
      }, 300);
    } else if (msg.type === 'pauseForLevelUp') {
      // Level-up paused! Simulate teammate killing boss
      setTimeout(() => {
        guestBus.send('bossKilled', {});
      }, 300);
    } else if (msg.type === 'revivePartners') {
      console.log('REVIVAL IMMUNITY RECEIVED: 3 SECONDS!');
      console.log('ALL CO-OP MULTIPLAYER TESTS PASSED VIA GLOBAL WEBSOCKET!');
      hostBus.close();
      guestBus.close();
      process.exit(0);
    }
  });

  // Start handshake
  setTimeout(() => {
    console.log('Guest sending join request to Host over global broker...');
    guestBus.send('join', { code, name: 'GuestPlayer' });
  }, 1200);

  setTimeout(() => {
    console.error('Test timed out. hostReceivedJoin:', hostReceivedJoin, 'guestReceivedRoster:', guestReceivedRoster, 'allReady:', allReadyHandshake, 'hit:', guestHitProcessed, 'lvl:', levelUpSync, 'revive:', reviveTriggered);
    hostBus.close();
    guestBus.close();
    process.exit(1);
  }, 9000);
}

testMultiplayer();
