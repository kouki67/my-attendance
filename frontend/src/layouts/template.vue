<script setup>
import { useRoute } from 'vue-router';

const route = useRoute();
</script>

<template>
	<header class="app-header">
		<div class="header-inner">
			<h1>勤怠管理</h1>
			<nav class="nav">
				<RouterLink to="/" :class="{ active: route.name === 'punch' }">打刻</RouterLink>
				<RouterLink to="/list" :class="{ active: route.name === 'list' }">一覧</RouterLink>
			</nav>
		</div>
	</header>
	<RouterView/>
</template>

<style scoped lang="scss">
.app-header {
	height: 50px;
	position: sticky;
	top: 0;
	z-index: 10;
	background: #fff;
	border-bottom: 1px solid #e5e7eb;
}

.header-inner {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin: 0 auto;
	padding: 14px 20px;
}

h1 {
	margin: 0;
	font-size: 20px;
	font-weight: 700;
	color: #111827;
	font-family: "Hiragino Sans", "Noto Sans JP", sans-serif;
}

.nav {
	display: flex;
	gap: 14px;
}

.nav a {
	color: #4b5563;
	text-decoration: none;
	font-weight: 600;
	padding: 6px 10px;
	border-radius: 999px;
	transition: background 0.2s ease, color 0.2s ease;
}

.nav a.active {
	background: #111827;
	color: #fff;
}

@media (max-width: 640px) {
	.header-inner {
		padding: 12px 16px;
	}

	h1 {
		font-size: 18px;
	}
}
</style>
