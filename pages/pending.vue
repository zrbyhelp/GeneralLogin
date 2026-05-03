<template>
  <div class="page-panel">
    <section class="panel-card panel-card--strong pending-card">
      <span class="badge badge--warn">待审核</span>
      <h1>申请已提交</h1>
      <p class="muted">
        管理员审核通过后，你会在服务列表中看到可访问的网站服务。
      </p>
      <div class="action-row">
        <NuxtLink class="ghost-btn" to="/apps">刷新服务列表</NuxtLink>
        <NuxtLink class="ghost-btn" to="/login">返回登录</NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.pending-card {
  width: min(560px, 100%);
  margin-top: clamp(80px, 18vh, 180px);
  padding: 32px;
}

h1 {
  margin: 14px 0 10px;
  font-size: 38px;
}
</style>
