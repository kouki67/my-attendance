<script setup>
import { onMounted, ref } from 'vue';
import { apiRequest } from '../../lib/api.js';

const month = ref('');
const rows = ref([]);
const message = ref('');
const messageType = ref('info');

const editingSessionId = ref(null);
const editStart = ref('');
const editEnd = ref('');
const breaks = ref([]);
const newBreakStart = ref('');
const newBreakEnd = ref('');

const pad = (value) => String(value).padStart(2, '0');

const toMonthValue = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

const toInputValue = (value) => {
	if (!value) return '';
	return value.replace(' ', 'T').slice(0, 16);
};

const fromInputValue = (value) => {
	if (!value) return '';
	if (value.length === 16) {
		return `${value.replace('T', ' ')}:00`;
	}
	return value.replace('T', ' ');
};

const formatDuration = (seconds) => {
	if (!seconds) return '00:00';
	const mins = Math.floor(seconds / 60);
	const hh = pad(Math.floor(mins / 60));
	const mm = pad(mins % 60);
	return `${hh}:${mm}`;
};

const loadSessions = async () => {
	message.value = '';
	try {
		const data = await apiRequest(`/attendance/sessions?month=${month.value}`);
		rows.value = data.rows;
	} catch (error) {
		message.value = error.message;
		messageType.value = 'error';
	}
};

const openEdit = async (row) => {
	if (!row.session_id) return;
	editingSessionId.value = row.session_id;
	editStart.value = toInputValue(row.start_at);
	editEnd.value = toInputValue(row.end_at);
	newBreakStart.value = '';
	newBreakEnd.value = '';
	try {
		const data = await apiRequest(`/attendance/sessions/${row.session_id}/breaks`);
		breaks.value = data.breaks.map((item) => ({
			...item,
			break_start_at: toInputValue(item.break_start_at),
			break_end_at: toInputValue(item.break_end_at),
		}));
	} catch (error) {
		message.value = error.message;
		messageType.value = 'error';
	}
};

const closeEdit = () => {
	editingSessionId.value = null;
	breaks.value = [];
};

const saveSession = async () => {
	if (!editingSessionId.value) return;
	message.value = '';
	try {
		await apiRequest(`/attendance/sessions/${editingSessionId.value}`, {
			method: 'PUT',
			body: JSON.stringify({
				start_at: fromInputValue(editStart.value),
				end_at: fromInputValue(editEnd.value),
			}),
		});
		message.value = '業務時間を更新しました';
		messageType.value = 'success';
		await loadSessions();
	} catch (error) {
		message.value = error.message;
		messageType.value = 'error';
	}
};

const reloadBreaks = async () => {
	const row = rows.value.find((item) => item.session_id === editingSessionId.value);
	if (row) {
		await openEdit(row);
	}
};

const addBreak = async () => {
	if (!editingSessionId.value) return;
	message.value = '';
	try {
		await apiRequest(`/attendance/sessions/${editingSessionId.value}/breaks`, {
			method: 'POST',
			body: JSON.stringify({
				break_start_at: fromInputValue(newBreakStart.value),
				break_end_at: fromInputValue(newBreakEnd.value),
			}),
		});
		message.value = '休憩を追加しました';
		messageType.value = 'success';
		await reloadBreaks();
		await loadSessions();
	} catch (error) {
		message.value = error.message;
		messageType.value = 'error';
	}
};

const updateBreak = async (item) => {
	message.value = '';
	try {
		await apiRequest(`/attendance/breaks/${item.id}`, {
			method: 'PUT',
			body: JSON.stringify({
				break_start_at: fromInputValue(item.break_start_at),
				break_end_at: fromInputValue(item.break_end_at),
			}),
		});
		message.value = '休憩を更新しました';
		messageType.value = 'success';
		await loadSessions();
	} catch (error) {
		message.value = error.message;
		messageType.value = 'error';
	}
};

const deleteBreak = async (item) => {
	message.value = '';
	try {
		await apiRequest(`/attendance/breaks/${item.id}`, { method: 'DELETE' });
		message.value = '休憩を削除しました';
		messageType.value = 'success';
		await reloadBreaks();
		await loadSessions();
	} catch (error) {
		message.value = error.message;
		messageType.value = 'error';
	}
};

onMounted(() => {
	month.value = toMonthValue(new Date());
	loadSessions();
});
</script>

<template>
	<div class="page">
		<div class="toolbar">
			<div class="month">
				<label for="month">対象月</label>
				<input id="month" type="month" v-model="month" @change="loadSessions" />
			</div>
			<p class="hint">編集は業務データがある日のみ可能です。</p>
		</div>

		<section v-if="message" class="message" :class="messageType">
			{{ message }}
		</section>

		<div class="table-wrapper">
			<table>
				<thead>
					<tr>
						<th>日付</th>
						<th>業務開始</th>
						<th>業務終了</th>
						<th>休憩合計</th>
						<th>実働</th>
						<th>編集</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="row in rows" :key="row.work_date">
						<td>{{ row.work_date }}</td>
						<td>{{ row.start_at || '-' }}</td>
						<td>{{ row.end_at || '-' }}</td>
						<td>{{ formatDuration(row.break_seconds) }}</td>
						<td>{{ formatDuration(row.net_seconds) }}</td>
						<td>
							<button
								class="link"
								:disabled="!row.session_id"
								@click="openEdit(row)"
							>
								編集
							</button>
						</td>
					</tr>
				</tbody>
			</table>
		</div>

		<section v-if="editingSessionId" class="editor">
			<div class="editor-header">
				<h3>業務時間の編集</h3>
				<button class="link" @click="closeEdit">閉じる</button>
			</div>
			<div class="editor-grid">
				<label>
					開始
					<input type="datetime-local" v-model="editStart" />
				</label>
				<label>
					終了
					<input type="datetime-local" v-model="editEnd" />
				</label>
				<button class="btn" @click="saveSession">業務時間を保存</button>
			</div>

			<div class="breaks">
				<h4>休憩の編集</h4>
				<div v-if="breaks.length === 0" class="muted">休憩が登録されていません。</div>
				<div v-for="item in breaks" :key="item.id" class="break-row">
					<input type="datetime-local" v-model="item.break_start_at" />
					<input type="datetime-local" v-model="item.break_end_at" />
					<button class="btn small" @click="updateBreak(item)">更新</button>
					<button class="btn ghost small" @click="deleteBreak(item)">削除</button>
				</div>
			</div>

			<div class="breaks add">
				<h4>休憩の追加</h4>
				<div class="break-row">
					<input type="datetime-local" v-model="newBreakStart" />
					<input type="datetime-local" v-model="newBreakEnd" />
					<button class="btn small" @click="addBreak">追加</button>
				</div>
			</div>
		</section>
	</div>
</template>

<style scoped lang="scss">
.page {
	min-height: calc(100vh - 50px);
	padding: 28px 32px 48px;
	background: linear-gradient(180deg, #f6f1ea 0%, #f2f4f7 45%, #edf0f6 100%);
	font-family: "Hiragino Sans", "Yu Gothic", "BIZ UDPGothic", sans-serif;
	color: #1f2937;
}

.toolbar {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 16px;
	flex-wrap: wrap;
	margin-bottom: 16px;
}

.month {
	display: flex;
	align-items: center;
	gap: 12px;
	background: #fff;
	padding: 10px 14px;
	border-radius: 12px;
	box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
}

.month input {
	border: none;
	font-size: 14px;
	background: transparent;
}

.hint {
	margin: 0;
	font-size: 13px;
	color: #6b7280;
}

.table-wrapper {
	background: #fff;
	border-radius: 16px;
	box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
	overflow: hidden;
}

table {
	width: 100%;
	border-collapse: collapse;
	font-size: 14px;
}

thead {
	background: #1f2937;
	color: #f9fafb;
}

th, td {
	padding: 14px 12px;
	text-align: left;
	border-bottom: 1px solid #e5e7eb;
}

tbody tr:hover {
	background: #f9fafb;
}

.link {
	border: none;
	background: none;
	color: #1d4ed8;
	cursor: pointer;
	font-weight: 600;
}

.link:disabled {
	color: #9ca3af;
	cursor: not-allowed;
}

.editor {
	margin-top: 24px;
	background: #fff;
	padding: 20px;
	border-radius: 16px;
	box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
	display: flex;
	flex-direction: column;
	gap: 20px;
}

.editor-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.editor-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	gap: 16px;
	align-items: end;
}

.editor-grid label {
	display: grid;
	gap: 6px;
	font-size: 13px;
	color: #4b5563;
}

.editor-grid input {
	border: 1px solid #d1d5db;
	border-radius: 10px;
	padding: 10px;
	font-size: 14px;
}

.breaks {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.break-row {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
	gap: 10px;
	align-items: center;
}

.btn {
	border: none;
	border-radius: 12px;
	padding: 10px 14px;
	background: #1f2937;
	color: #fff;
	font-size: 14px;
	cursor: pointer;
}

.btn.small {
	padding: 8px 12px;
	font-size: 13px;
}

.btn.ghost {
	background: #f3f4f6;
	color: #1f2937;
}

.muted {
	font-size: 13px;
	color: #9ca3af;
}

.message {
	padding: 10px 14px;
	border-radius: 12px;
	font-size: 14px;
	margin-bottom: 12px;
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

@media (max-width: 720px) {
	.page {
		padding: 24px 16px 32px;
	}

	.table-wrapper {
		overflow-x: auto;
	}
}
</style>
