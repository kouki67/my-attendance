<script setup>
</script>

<template>
	<header class="app-header">
		<div class="header-inner">
			<h1>これはテンプレートです</h1>
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
	// max-width: 1100px;
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

@media (max-width: 640px) {
	.header-inner {
		padding: 12px 16px;
	}

	h1 {
		font-size: 18px;
	}
}
</style>
