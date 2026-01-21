<template>
  <div class="not-found-container">
    <div class="not-found-content">
      <!-- Imagen 404 -->
      <div class="image-container">
        <img
          src="/404.png"
          alt="404 - Page Not Found"
          class="not-found-image"
          loading="eager"
        />
      </div>

      <!-- Mensaje principal -->
      <div class="message-container">
        <h1 class="title">Oops! Page Not Found</h1>
        <p class="description">
          The page you're looking for doesn't exist or has been moved. Maybe you
          mistyped the URL, or the content is no longer available.
        </p>

        <!-- Estadísticas útiles -->
        <div class="stats" v-if="stats">
          <div
            class="stat-item"
            v-for="(stat, index) in statsList"
            :key="stat.label"
            :style="{ animationDelay: `${index * 0.1}s` }"
          >
            <span class="stat-label">{{ stat.label }}:</span>
            <span class="stat-value">{{ stat.value }}</span>
          </div>
        </div>
      </div>

      <!-- Footer de la página 404 -->
      <div class="not-found-footer">
        <p>
          Need help?
          <a href="/" @click.prevent="goHome" class="footer-link"
            >Visit Homepage</a
          >
          or
          <a
            href="https://github.com/al3hz/Booru-Explorer/issues"
            target="_blank"
            class="footer-link"
          >
            Report an Issue
          </a>
        </p>
        <p class="copyright">© {{ currentYear }} Booru Explorer</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

// Estados reactivos
const stats = ref(true);
const showRefresh = ref(false);

// Computed properties
const requestedPath = computed(() => route.fullPath);
const currentTime = computed(() => {
  return new Date().toLocaleTimeString("en-US", {
    hour12: true,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
});

const currentYear = computed(() => new Date().getFullYear());

// Computed para estadísticas
const statsList = computed(() => [
  { label: "Error Code", value: "404" },
  { label: "Requested URL", value: requestedPath.value },
  { label: "Time", value: currentTime.value },
]);

// Métodos
const goHome = () => {
  router.push("/");
};

// Verificar si es apropiado mostrar refresh
const checkRefreshNeeded = () => {
  if (performance && performance.timing) {
    const loadTime =
      performance.timing.loadEventEnd - performance.timing.navigationStart;
    showRefresh.value = loadTime > 30000;
  }
};

// Efectos
onMounted(() => {
  checkRefreshNeeded();
});
</script>

<style scoped>
.not-found-container {
  min-height: calc(100vh - 160px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  background: linear-gradient(
    135deg,
    rgba(15, 23, 42, 0.97) 0%,
    rgba(30, 41, 59, 0.97) 100%
  );
  color: #e2e8f0;
}

.not-found-content {
  max-width: 800px;
  width: 100%;
  text-align: center;
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(10px);
  border-radius: 24px;
  padding: 40px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

/* Imagen con animación mejorada */
.image-container {
  margin-bottom: 30px;
}

.not-found-image {
  max-width: 300px;
  width: 100%;
  height: auto;
  filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.3));
  animation:
    float 6s ease-in-out infinite,
    glow 3s ease-in-out infinite alternate;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  25% {
    transform: translateY(-12px) rotate(1deg);
  }
  75% {
    transform: translateY(-8px) rotate(-1deg);
  }
}

@keyframes glow {
  from {
    filter: drop-shadow(0 10px 20px rgba(139, 92, 246, 0.3));
  }
  to {
    filter: drop-shadow(0 10px 30px rgba(139, 92, 246, 0.5));
  }
}

/* Mensaje */
.title {
  font-size: 2.5rem;
  font-weight: 800;
  background: linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 16px;
  animation: title-appear 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes title-appear {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.description {
  font-size: 1.1rem;
  line-height: 1.6;
  color: #94a3b8;
  margin-bottom: 30px;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
  animation: fade-in-up 0.6s 0.2s both cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Estadísticas con animación escalonada */
.stats {
  display: flex;
  justify-content: center;
  gap: 30px;
  margin-bottom: 40px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  opacity: 0;
  transform: translateY(20px);
  animation: stat-appear 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes stat-appear {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.stat-item:hover {
  background: rgba(139, 92, 246, 0.1);
  border-color: rgba(139, 92, 246, 0.3);
  transform: translateY(-2px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.stat-label {
  font-size: 0.9rem;
  color: #94a3b8;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 1.2rem;
  font-weight: 600;
  color: #a78bfa;
  font-family: "JetBrains Mono", "Fira Code", monospace;
  text-shadow: 0 2px 4px rgba(139, 92, 246, 0.2);
}

/* NUEVO: Detalles técnicos con implementación custom */
.additional-info {
  margin-bottom: 30px;
}

.details-custom {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.03) 0%,
    rgba(139, 92, 246, 0.05) 100%
  );
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.details-custom.open {
  box-shadow:
    0 10px 40px rgba(139, 92, 246, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  border-color: rgba(139, 92, 246, 0.3);
}

.summary-custom {
  width: 100%;
  padding: 20px 24px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #cbd5e1;
  font-weight: 600;
  font-size: 1.1rem;
  background: transparent;
  border: none;
  text-align: left;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.summary-custom::before {
  content: "";
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(139, 92, 246, 0.1),
    transparent
  );
  transition: left 0.6s ease;
}

.summary-custom:hover::before {
  left: 100%;
}

.summary-custom:hover {
  background: rgba(139, 92, 246, 0.05);
  color: #a78bfa;
}

.summary-text {
  display: flex;
  align-items: center;
  gap: 10px;
}

.summary-icon {
  font-size: 1.2rem;
}

.summary-custom i {
  font-size: 1.2rem;
  transition: all 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55);
}

/* NUEVAS transiciones custom que funcionan */
.slide-down-custom-enter-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.slide-down-custom-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 1, 1);
  overflow: hidden;
}

.slide-down-custom-enter-from,
.slide-down-custom-leave-to {
  opacity: 0;
  transform: translateY(-10px);
  height: 0;
}

.details-content-wrapper {
  overflow: hidden;
}

.details-content {
  padding: 0 24px 24px;
  text-align: left;
}

.detail-item {
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  opacity: 0;
  transform: translateX(-10px);
  animation: detail-slide-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

/* Reiniciar animación cuando se abre nuevamente */
.details-custom.open .detail-item {
  animation: detail-slide-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes detail-slide-in {
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.detail-item:last-child {
  border-bottom: none;
}

.detail-item strong {
  color: #a78bfa;
  font-weight: 600;
  min-width: 120px;
  display: inline-block;
}

.detail-value {
  color: #94a3b8;
  font-family: "JetBrains Mono", "Fira Code", monospace;
  font-size: 0.9rem;
  word-break: break-all;
  margin-left: 8px;
}

.detail-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.copy-btn {
  padding: 10px 20px;
  background: rgba(139, 92, 246, 0.1);
  color: #a78bfa;
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
  font-weight: 500;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  flex: 1;
  justify-content: center;
}

.copy-btn:hover {
  background: rgba(139, 92, 246, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(139, 92, 246, 0.2);
}

.copy-btn.copied {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.3);
  color: #22c55e;
}

.copy-btn.copied:hover {
  background: rgba(34, 197, 94, 0.2);
}

.copy-btn i {
  font-size: 1.1rem;
  transition: transform 0.3s ease;
}

.copy-btn.copied i {
  animation: checkmark-bounce 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55);
}

@keyframes checkmark-bounce {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
}

.refresh-btn {
  padding: 10px 20px;
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
  font-weight: 500;
  transition: all 0.3s ease;
  flex: 1;
  justify-content: center;
}

.refresh-btn:hover {
  background: rgba(59, 130, 246, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(59, 130, 246, 0.2);
}

.refresh-btn i {
  animation: spin 2s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.debug-info {
  margin-top: 20px;
  padding: 15px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  animation: debug-fade-in 0.5s ease;
}

@keyframes debug-fade-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.debug-progress {
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #a78bfa, #7c3aed);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.debug-text {
  font-size: 0.85rem;
  color: #94a3b8;
  font-family: monospace;
}

/* Footer */
.not-found-footer {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  font-size: 0.9rem;
  opacity: 0;
  animation: fade-in 0.8s 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@keyframes fade-in {
  to {
    opacity: 1;
  }
}

.footer-link {
  color: #a78bfa;
  text-decoration: none;
  transition: all 0.3s ease;
  position: relative;
  padding-bottom: 2px;
}

.footer-link::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 1px;
  background: currentColor;
  transition: width 0.3s ease;
}

.footer-link:hover::after {
  width: 100%;
}

.footer-link:hover {
  color: #8b5cf6;
}

.copyright {
  margin-top: 8px;
  font-size: 0.85rem;
  opacity: 0.8;
}

/* Responsive */
@media (max-width: 768px) {
  .not-found-content {
    padding: 30px 20px;
  }

  .title {
    font-size: 2rem;
  }

  .stats {
    gap: 15px;
  }

  .stat-item {
    padding: 10px 15px;
  }

  .summary-custom {
    padding: 16px 20px;
    font-size: 1rem;
  }

  .details-content {
    padding: 0 20px 20px;
  }

  .detail-actions {
    flex-direction: column;
  }
}

@media (max-width: 480px) {
  .not-found-container {
    padding: 20px 10px;
  }

  .not-found-content {
    padding: 20px 15px;
  }

  .title {
    font-size: 1.75rem;
  }

  .description {
    font-size: 1rem;
  }

  .stats {
    flex-direction: column;
    align-items: center;
  }
}
</style>
