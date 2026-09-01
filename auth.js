(function(){
  if(!window.DRS_API?.live)return;
  const overlay=document.createElement('div');overlay.className='auth-overlay';overlay.innerHTML=`<section class="auth-card"><p class="eyebrow">DEBT RECOVERY SYSTEM</p><h1>Your private recovery workspace</h1><p id="authMessage">Sign in with the Gmail linked to your access.</p><label class="auth-license">Payhip license key <span>(if provided)</span><input id="licenseKey" autocomplete="off" placeholder="Enter your license key"></label><div id="googleButton"></div></section>`;document.body.appendChild(overlay);
  const reveal=()=>overlay.remove(),message=text=>{document.querySelector('#authMessage').textContent=text;};
  window.handleGoogleCredential=async response=>{try{await window.DRS_API.request('/api/auth/google',{method:'POST',body:JSON.stringify({credential:response.credential,licenseKey:document.querySelector('#licenseKey')?.value||''})});reveal();window.dispatchEvent(new Event('drs-authenticated'));}catch(error){message(error.message);}};
  window.DRS_API.request('/api/session').then(reveal).catch(()=>{
    const start=()=>{if(!window.google?.accounts?.id)return setTimeout(start,100);google.accounts.id.initialize({client_id:window.DRS_CONFIG.googleClientId,callback:window.handleGoogleCredential});google.accounts.id.renderButton(document.querySelector('#googleButton'),{theme:'outline',size:'large',width:280});};start();
  });
})();
