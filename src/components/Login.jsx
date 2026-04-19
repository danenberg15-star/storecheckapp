import { LogIn } from 'lucide-react';

export default function Login({ handleLogin }) {
  return (
    <div style={loginContainerStyle} dir="rtl">
      <div style={loginCardStyle}>
        <h1 style={{ marginBottom: '10px' }}>StoreCheck</h1>
        <button style={loginBtnStyle} onClick={handleLogin}>
          <LogIn size={20} /> התחברות גוגל
        </button>
      </div>
    </div>
  );
}

// Styles for Login only
const loginContainerStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f0f2f5' };
const loginCardStyle = { padding: '40px', backgroundColor: 'white', borderRadius: '25px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' };
const loginBtnStyle = { display: 'flex', alignItems: 'center', gap: '10px', padding: '15px 30px', backgroundColor: '#4285F4', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' };