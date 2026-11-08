import readline from 'readline';
import { authService } from '../services/authService.js';
import { pool } from '../database/db.js';

function askQuestion(query: string, hideInput: boolean = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    if (hideInput && process.stdin.isTTY) {
      // Prompt password secara tersembunyi
      process.stdout.write(query);
      let password = '';
      
      const onData = (char: Buffer) => {
        const str = char.toString('utf-8');
        if (str === '\n' || str === '\r' || str === '\u0004') {
          process.stdin.removeListener('data', onData);
          if (process.stdin.isRaw) process.stdin.setRawMode(false);
          rl.close();
          console.log('');
          resolve(password);
        } else if (str === '\u0003') {
          process.exit(1);
        } else if (str === '\b' || str === '\x7f') {
          if (password.length > 0) {
            password = password.slice(0, -1);
          }
        } else {
          password += str;
        }
      };

      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', onData);
    } else {
      rl.question(query, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

async function main() {
  console.log('====================================================');
  console.log('  Bootstrap Pembuatan Akun Administrator Pertama    ');
  console.log('====================================================\n');

  try {
    // Parse argumen CLI jika ada: --username <val> --password <val>
    const args = process.argv.slice(2);
    let username = '';
    let password = '';

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--username' && args[i + 1]) {
        username = args[i + 1].trim();
      }
      if (args[i] === '--password' && args[i + 1]) {
        password = args[i + 1].trim();
      }
    }

    if (!username) {
      username = await askQuestion('Masukkan username admin baru: ');
    }

    if (!username || username.length < 3) {
      console.error('❌ Error: Username harus minimal 3 karakter.');
      process.exit(1);
    }

    // Cek apakah username sudah ada
    const exists = await authService.userExists(username);
    if (exists) {
      console.error(`❌ Error: Akun dengan username "${username}" sudah ada.`);
      process.exit(1);
    }

    // Cek apakah sudah ada admin
    const [adminRows] = await pool.query('SELECT 1 FROM `app_users` WHERE `role` = ?', ['admin']);
    if ((adminRows as any[]).length > 0) {
      console.error('❌ Error: Akun administrator sudah ada. Tidak dapat membuat administrator baru melalui script bootstrap.');
      process.exit(1);
    }

    if (!password) {
      password = await askQuestion('Masukkan password admin (min 8 karakter): ', true);
    }

    if (!password || password.length < 8) {
      console.error('❌ Error: Password harus minimal 8 karakter.');
      process.exit(1);
    }

    // Buat akun admin
    const userId = await authService.createUser(username, password, 'admin');

    console.log('\n====================================================');
    console.log(`✅ Berhasil membuat akun administrator!`);
    console.log(`   - User ID  : ${userId}`);
    console.log(`   - Username : ${username}`);
    console.log(`   - Role     : admin`);
    console.log('====================================================\n');

    process.exit(0);
  } catch (err: any) {
    console.error('❌ Terjadi kesalahan saat membuat akun admin:', err.message || err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
