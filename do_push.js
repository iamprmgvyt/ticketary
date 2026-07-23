const { execSync } = require('child_process');
const path = require('path');

const repoPath = 'C:\\Users\\PC\\Downloads\\Ticketary';

try {
    console.log('📌 Executing Git Add...');
    execSync('git add .', { cwd: repoPath, stdio: 'inherit' });

    console.log('📌 Executing Git Commit...');
    try {
        execSync('git commit -m "feat: AI interview max 5 questions, optional category step & publish flow"', { cwd: repoPath, stdio: 'inherit' });
    } catch (e) {
        console.log('No new changes to commit or commit succeeded.');
    }

    console.log('📌 Executing Git Push...');
    execSync('git push origin main', { cwd: repoPath, stdio: 'inherit' });

    console.log('✅ SUCCESS: Push completed successfully to GitHub!');
} catch (err) {
    console.error('❌ Git Push Failed:', err.message);
}
