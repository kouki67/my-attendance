<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { apiRequest } from '../../lib/api.js';

const now = ref(new Date());
const status = ref('loading');
const netSeconds = ref(0);
const message = ref('');
const messageType = ref('info');

const days = ['日', '月', '火', '水', '木', '金', '土'];

const pad = (value) => String(value).padStart(2, '0');

const formatDate = (date) => {
	const yyyy = date.getFullYear();
	const mm = pad(date.getMonth() + 1);
	const dd = pad(date.getDate());
	const day = days[date.getDay()];
	return `${yyyy}-${mm}-${dd} (${day})`;
};

const formatTime = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
const formatDuration = (seconds) => {
	if (!seconds) return '00:00';
	const mins = Math.floor(seconds / 60);
	const hh = pad(Math.floor(mins / 60));
	const mm = pad(mins % 60);
	return `${hh}:${mm}`;
};

const dateText = computed(() => formatDate(now.value));
const timeText = computed(() => formatTime(now.value));
const netTimeText = computed(() => formatDuration(netSeconds.value));

let clockTimerId = null;
let syncTimerId = null;

const refreshStatus = async () => {
	try {
		const data = await apiRequest('/attendance/status');
		status.value = data.status;
		netSeconds.value = data.net_seconds || 0;
	} catch (error) {
		message.value = error.message;
		messageType.value = 'error';
	}
};

const punch = async (path) => {
	message.value = '';
	try {
		const data = await apiRequest(`/attendance${path}`, {
			method: 'POST',
		});
		message.value = data.message;
		messageType.value = 'success';
		await refreshStatus();
	} catch (error) {
		message.value = error.message;
		messageType.value = 'error';
	}
};

const buttonState = computed(() => {
	switch (status.value) {
		case 'not_started':
			return { workStart: true, workEnd: false, breakStart: false, breakEnd: false };
		case 'working':
			return { workStart: false, workEnd: true, breakStart: true, breakEnd: false };
		case 'on_break':
			return { workStart: false, workEnd: false, breakStart: false, breakEnd: true };
		case 'finished':
			return { workStart: false, workEnd: false, breakStart: false, breakEnd: false };
		default:
			return { workStart: false, workEnd: false, breakStart: false, breakEnd: false };
	}
});

const statusLabel = computed(() => {
	switch (status.value) {
		case 'not_started':
			return '未開始';
		case 'working':
			return '業務中';
		case 'on_break':
			return '休憩中';
		case 'finished':
			return '終了済み';
		case 'loading':
			return '読み込み中';
		default:
			return status.value;
	}
});

onMounted(() => {
	clockTimerId = window.setInterval(() => {
		now.value = new Date();
		if (status.value === 'working') {
			netSeconds.value += 1;
		}
	}, 1000);

	syncTimerId = window.setInterval(() => {
		refreshStatus();
	}, 30000);

	refreshStatus();
});

onUnmounted(() => {
	if (clockTimerId) {
		clearInterval(clockTimerId);
	}
	if (syncTimerId) {
		clearInterval(syncTimerId);
	}
});
</script>

<template>
	<div class="page">
		<section class="clock">
			<p class="date">{{ dateText }}</p>
			<p class="time">{{ timeText }}</p>
			<p class="status">
				現在の状態:
				<span>{{ statusLabel }}</span>
			</p>
			<p class="net">
				本日の実働: <strong>{{ netTimeText }}</strong>
			</p>
		</section>

		<section class="controls">
			<button
				class="btn primary"
				:disabled="!buttonState.workStart"
				@click="punch('/work/start')"
			>
				業務開始
			</button>
			<button
				class="btn"
				:disabled="!buttonState.workEnd"
				@click="punch('/work/end')"
			>
				業務終了
			</button>
			<button
				class="btn"
				:disabled="!buttonState.breakStart"
				@click="punch('/break/start')"
			>
				休憩開始
			</button>
			<button
				class="btn"
				:disabled="!buttonState.breakEnd"
				@click="punch('/break/end')"
			>
				休憩終了
			</button>
		</section>

		<section v-if="message" class="message" :class="messageType">
			{{ message }}
		</section>
	</div>
</template>

<style scoped lang="scss">
.page {
	min-height: calc(100vh - 50px);
	padding: 32px 32px 40px;
	background: linear-gradient(160deg, #f4f6fb 0%, #eef1f8 45%, #e3e8f2 100%);
	font-family: "Hiragino Sans", "Yu Gothic", "BIZ UDPGothic", sans-serif;
	display: flex;
	flex-direction: column;
	gap: 32px;
	align-items: center;
	justify-content: center;
}

.clock {
	text-align: center;
	background: rgba(255, 255, 255, 0.7);
	border-radius: 20px;
	padding: 32px 40px;
	box-shadow: 0 14px 40px rgba(15, 23, 42, 0.12);
	backdrop-filter: blur(10px);
}

.date {
	margin: 0;
	font-size: 22px;
	letter-spacing: 0.08em;
	color: #24324a;
}

.time {
	margin: 12px 0 8px;
	font-size: clamp(52px, 8vw, 88px);
	font-weight: 700;
	color: #101a2f;
}

.status {
	margin: 0;
	font-size: 14px;
	color: #4b5563;
}

.net {
	margin: 8px 0 0;
	font-size: 15px;
	color: #1f2937;
}

.net strong {
	font-size: 20px;
	letter-spacing: 0.04em;
}

.controls {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
	gap: 16px;
	width: min(680px, 100%);
}

.btn {
	border: none;
	border-radius: 16px;
	padding: 16px 20px;
	font-size: 16px;
	font-weight: 600;
	color: #1f2937;
	background: #f1f4f9;
	box-shadow: 0 10px 18px rgba(15, 23, 42, 0.12);
	cursor: pointer;
	transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
}

.btn.primary {
	background: #1b3a6b;
	color: #fff;
}

.btn:disabled {
	opacity: 0.4;
	cursor: not-allowed;
	box-shadow: none;
}

.btn:not(:disabled):hover {
	transform: translateY(-2px);
	box-shadow: 0 12px 22px rgba(15, 23, 42, 0.18);
}

.message {
	padding: 12px 18px;
	border-radius: 12px;
	font-size: 14px;
	background: #f3f4f6;
	color: #1f2937;
}

.message.success {
	background: #e6f7ef;
	color: #0f5132;
}

.message.error {
	background: #fdecea;
	color: #7a271a;
}

@media (max-width: 640px) {
	.page {
		padding: 24px 16px 32px;
	}

	.clock {
		padding: 24px 20px;
		width: 100%;
	}
}
</style>
