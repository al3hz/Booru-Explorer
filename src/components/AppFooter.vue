<template>
  <footer class="app-footer" role="contentinfo">
    <div class="footer-content">
      <p class="copyright">
        All rights reserved to
        <a
          href="https://danbooru.donmai.us/"
          target="_blank"
          rel="noopener noreferrer"
          class="footer-link"
        >
          Danbooru
        </a>
        • Data provided via API
      </p>

      <div class="social-links">
        <a
          href="https://github.com/al3hz/Booru-Explorer"
          target="_blank"
          rel="noopener noreferrer"
          class="github-link"
          aria-label="View source code on GitHub"
          title="GitHub Repository"
        >
          <i class="lni lni-github" aria-hidden="true"></i>
        </a>
      </div>
    </div>
  </footer>
</template>

<script setup>
// Componente Footer - No requiere lógica reactiva
// Importar explícitamente si necesitas utilidades en el futuro
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
  animation-delay: 0.2s;
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

.copyright {
  color: #94a3b8;
  font-size: 13px;
  margin: 0;
  line-height: 1.5;
  animation: elementPop 0.5s ease 0.4s backwards;
}

.footer-link {
  color: #a78bfa;
  text-decoration: none;
  transition: all 0.2s ease;
  font-weight: 500;
}

.footer-link:hover {
  color: #c084fc;
  text-decoration: underline;
}

.footer-link:focus-visible {
  outline: 2px solid #a78bfa;
  outline-offset: 2px;
  border-radius: 2px;
}

.social-links {
  display: flex;
  gap: 20px;
  align-items: center;
}

.github-link {
  color: #94a3b8;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  padding: 8px;
  border-radius: 50%;
  animation: elementPop 0.5s ease 0.5s backwards;
}

.github-link:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
  transform: scale(1.1) translateY(-2px);
}

.github-link:focus-visible {
  outline: 2px solid #a78bfa;
  outline-offset: 2px;
  background: rgba(167, 139, 250, 0.1);
}

@media (max-width: 768px) {
  .app-footer {
    margin-top: 40px;
    padding: 20px 0;
  }

  .footer-content {
    padding: 0 20px;
    gap: 12px;
  }

  .copyright {
    font-size: 12px;
  }

  .github-link {
    font-size: 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-footer,
  .copyright,
  .github-link {
    animation: none;
  }

  .github-link:hover {
    transform: none;
  }
}
</style>
