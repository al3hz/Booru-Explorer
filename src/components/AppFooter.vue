<template>
  <footer class="app-footer">
    <div class="footer-content">
      <p class="copyright">
        All rights reserved to 
        <a href="https://danbooru.donmai.us/" target="_blank" class="footer-link">
          https://danbooru.donmai.us/
        </a>
      </p>
      <div class="social-links">
        <a href="https://github.com/al3hz/Booru-Explorer" target="_blank" class="github-link" aria-label="View on GitHub">
          <i class="lni lni-github"></i>
        </a>
      </div>
    </div>
  </footer>
</template>

<script>
export default {
  name: "AppFooter"
};
</script>

<style scoped>
.app-footer {
  margin-top: 60px;
  padding: 30px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  background: linear-gradient(
    to bottom,
    rgba(20, 20, 28, 0.8) 0%,
    rgba(20, 20, 28, 0.95) 100%
  );
  backdrop-filter: blur(10px);
  animation: footerSlideUp 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
  animation-delay: 0.2s; /* Wait slightly for main content */
}

@keyframes footerSlideUp {
  0% {
    opacity: 0;
    transform: translateY(30px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes elementPop {
  0% {
    opacity: 0;
    transform: translateY(10px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.footer-content {
  max-width: 1600px;
  margin: 0 auto;
  padding: 0 30px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.social-links {
  display: flex;
  gap: 20px;
  align-items: center;
}

.copyright {
  color: #94a3b8;
  font-size: 13px;
  margin: 0;
  animation: elementPop 0.5s ease 0.4s backwards;
}

.footer-link {
  color: #a78bfa;
  text-decoration: none;
  transition: all 0.2s ease;
}

.footer-link:hover {
  color: #c084fc;
  text-decoration: underline;
}

.github-link {
  color: #94a3b8;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  animation: elementPop 0.5s ease 0.5s backwards;
}

.github-link:hover {
  color: #fff;
  transform: scale(1.1);
}

@media (max-width: 768px) {
  .footer-content {
    padding: 0 20px;
  }
  
  .copyright {
    font-size: 12px;
  }
}
</style>