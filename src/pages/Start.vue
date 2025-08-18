<template>
  <div class="p-8 flex flex-col h-full justify-between">
    <div></div>
    <img id="logo" src="/images/logo-transparent.png" alt="PRIM Photobooth">
    <!-- <h1 class="text-7xl font-bold tracking-widest">LOGO</h1> -->
    <p id="touchtostart" class="text-2xl uppercase whitespace-nowrap tracking-wider">Touch anywhere to start</p>
  </div>
  <router-link to="/templates" class="absolute w-screen h-screen top-0 left-0"></router-link>
</template>

<style scoped>
#logo {
  width: auto;
  max-width: 50vw;
  max-height: 70vh;
  margin: 0 auto;
}
#touchtostart {
  font-size: 24px;
  text-align: center;
  background: linear-gradient(90deg, #000 20%, #fff 40%, #000 60%);
  background-size: 200% auto;
  color: #000;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: shimmer 2s linear infinite;
}

@keyframes fadePulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}
@keyframes scalePulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}
@keyframes shimmer {
  to { background-position: 200% center; }
}
</style>