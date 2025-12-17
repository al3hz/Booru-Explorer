<template>
  <footer class="app-footer">
    <div class="footer-content">
      <p class="copyright">
        All rights reserved to 
        <a href="https://danbooru.donmai.us/" target="_blank" class="footer-link">
          https://danbooru.donmai.us/
        </a>
      </p>
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
  padding: 20px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  background: linear-gradient(
    to bottom,
    rgba(20, 20, 28, 0.8) 0%,
    rgba(20, 20, 28, 0.95) 100%
  );
  backdrop-filter: blur(10px);
}

.footer-content {
  max-width: 1600px;
  margin: 0 auto;
  padding: 0 30px;
  text-align: center;
}

.copyright {
  color: #94a3b8;
  font-size: 13px;
  margin: 0;
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

@media (max-width: 768px) {
  .footer-content {
    padding: 0 20px;
  }
  
  .copyright {
    font-size: 12px;
  }
}
</style>