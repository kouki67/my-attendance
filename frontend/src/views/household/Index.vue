<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { apiRequest } from '../../lib/api.js';

const pad = (value) => String(value).padStart(2, '0');
const toYyyyMm = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
const toYyyyMmDd = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const formatYen = (value) => `${Number(value || 0).toLocaleString('ja-JP')}円`;

const month = ref(toYyyyMm());
const cards = ref([]);
const cardEdits = ref({});
const expenses = ref([]);
const payments = ref([]);
const totals = ref({ total: 0, cash: 0, credit: 0 });
const loading = ref(false);
const message = ref('');
const messageType = ref('info');

const newCardName = ref('');
const newCardPaymentDay = ref(27);

const form = ref({
	expense_date: toYyyyMmDd(),
	category: '',
	description: '',
	amount: '',
	payment_method: 'cash',
	credit_card_id: '',
});

const canSubmitExpense = computed(() => {
	if (!form.value.expense_date || !form.value.category || !form.value.amount) return false;
	if (form.value.payment_method === 'credit_card' && !form.value.credit_card_id) return false;
	return true;
});

const setMessage = (text, type = 'info') => {
	message.value = text;
	messageType.value = type;
};

const buildCardEditMap = (list) => {
	cardEdits.value = list.reduce((acc, card) => {
		acc[card.id] = {
			name: card.name,
			payment_day: card.payment_day,
		};
		return acc;
	}, {});
};

const fetchCards = async () => {
	const data = await apiRequest('/household/cards');
	cards.value = data.cards || [];
	buildCardEditMap(cards.value);
	if (
		form.value.payment_method === 'credit_card'
		&& form.value.credit_card_id
		&& !cards.value.some((card) => card.id === Number(form.value.credit_card_id))
	) {
		form.value.credit_card_id = '';
	}
};

const fetchExpenses = async () => {
	const data = await apiRequest(`/household/expenses?month=${month.value}`);
	expenses.value = data.expenses || [];
	totals.value = data.totals || { total: 0, cash: 0, credit: 0 };
};

const fetchPayments = async () => {
	const data = await apiRequest(`/household/payment-schedule?month=${month.value}`);
	payments.value = data.payments || [];
};

const loadAll = async () => {
	loading.value = true;
	try {
		await Promise.all([fetchCards(), fetchExpenses(), fetchPayments()]);
	} catch (error) {
		setMessage(error.message, 'error');
	} finally {
		loading.value = false;
	}
};

const addCard = async () => {
	setMessage('');
	try {
		await apiRequest('/household/cards', {
			method: 'POST',
			body: JSON.stringify({
				name: newCardName.value,
				payment_day: Number(newCardPaymentDay.value),
			}),
		});
		newCardName.value = '';
		newCardPaymentDay.value = 27;
		await fetchCards();
		setMessage('カードを追加しました', 'success');
	} catch (error) {
		setMessage(error.message, 'error');
	}
};

const updateCard = async (cardId) => {
	const target = cardEdits.value[cardId];
	if (!target) return;
	setMessage('');
	try {
		await apiRequest(`/household/cards/${cardId}`, {
			method: 'PUT',
			body: JSON.stringify({
				name: target.name,
				payment_day: Number(target.payment_day),
			}),
		});
		await Promise.all([fetchCards(), fetchExpenses(), fetchPayments()]);
		setMessage('カード設定を更新しました', 'success');
	} catch (error) {
		setMessage(error.message, 'error');
	}
};

const deleteCard = async (card) => {
	const ok = window.confirm(`「${card.name}」を削除します。よろしいですか？`);
	if (!ok) return;
	setMessage('');
	try {
		await apiRequest(`/household/cards/${card.id}`, { method: 'DELETE' });
		await fetchCards();
		setMessage('カードを削除しました', 'success');
	} catch (error) {
		setMessage(error.message, 'error');
	}
};

const addExpense = async () => {
	setMessage('');
	try {
		await apiRequest('/household/expenses', {
			method: 'POST',
			body: JSON.stringify({
				expense_date: form.value.expense_date,
				category: form.value.category,
				description: form.value.description,
				amount: Number(form.value.amount),
				payment_method: form.value.payment_method,
				credit_card_id: form.value.payment_method === 'credit_card'
					? Number(form.value.credit_card_id)
					: null,
			}),
		});
		form.value.category = '';
		form.value.description = '';
		form.value.amount = '';
		form.value.payment_method = 'cash';
		form.value.credit_card_id = '';
		await Promise.all([fetchExpenses(), fetchPayments()]);
		setMessage('支出を登録しました', 'success');
	} catch (error) {
		setMessage(error.message, 'error');
	}
};

watch(month, async () => {
	try {
		await Promise.all([fetchExpenses(), fetchPayments()]);
	} catch (error) {
		setMessage(error.message, 'error');
	}
});

onMounted(() => {
	loadAll();
});
</script>

<template>
	<div class="household-page">
		<section class="panel">
			<div class="panel-header">
				<h2>家計簿</h2>
				<input v-model="month" type="month" />
			</div>
			<p class="summary">
				合計: <strong>{{ formatYen(totals.total) }}</strong>
				<span>現金 {{ formatYen(totals.cash) }}</span>
				<span>クレカ {{ formatYen(totals.credit) }}</span>
			</p>
		</section>

		<section class="panel">
			<h3>クレジットカード設定</h3>
			<div class="inline-form">
				<input v-model="newCardName" type="text" placeholder="カード名 (例: 楽天カード)" />
				<input v-model.number="newCardPaymentDay" type="number" min="1" max="31" />
				<button class="btn primary" @click="addCard">カード追加</button>
			</div>

			<div class="card-list">
				<div v-for="card in cards" :key="card.id" class="card-item">
					<input v-model="cardEdits[card.id].name" type="text" />
					<input v-model.number="cardEdits[card.id].payment_day" type="number" min="1" max="31" />
					<button class="btn" @click="updateCard(card.id)">保存</button>
					<button class="btn danger" @click="deleteCard(card)">削除</button>
				</div>
				<p v-if="cards.length === 0" class="empty">カードがまだ登録されていません</p>
			</div>
		</section>

		<section class="panel">
			<h3>支出を追加</h3>
			<div class="expense-form">
				<input v-model="form.expense_date" type="date" />
				<input v-model="form.category" type="text" placeholder="カテゴリ (食費・日用品など)" />
				<input v-model="form.description" type="text" placeholder="内容 (任意)" />
				<input v-model.number="form.amount" type="number" min="1" placeholder="金額" />
				<select v-model="form.payment_method">
					<option value="cash">現金</option>
					<option value="credit_card">クレジットカード</option>
				</select>
				<select v-if="form.payment_method === 'credit_card'" v-model="form.credit_card_id">
					<option disabled value="">カードを選択</option>
					<option v-for="card in cards" :key="card.id" :value="card.id">
						{{ card.name }} (支払日: 毎月{{ card.payment_day }}日)
					</option>
				</select>
				<button class="btn primary" :disabled="!canSubmitExpense" @click="addExpense">登録</button>
			</div>
		</section>

		<section class="panel">
			<h3>支出一覧</h3>
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th>日付</th>
							<th>カテゴリ</th>
							<th>内容</th>
							<th>支払方法</th>
							<th>請求日</th>
							<th class="right">金額</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="row in expenses" :key="row.id">
							<td>{{ row.expense_date }}</td>
							<td>{{ row.category }}</td>
							<td>{{ row.description || '-' }}</td>
							<td>
								<span v-if="row.payment_method === 'cash'">現金</span>
								<span v-else>{{ row.credit_card_name }}</span>
							</td>
							<td>{{ row.scheduled_payment_date || '-' }}</td>
							<td class="right">{{ formatYen(row.amount) }}</td>
						</tr>
						<tr v-if="expenses.length === 0">
							<td colspan="6" class="empty">この月の支出はまだありません</td>
						</tr>
					</tbody>
				</table>
			</div>
		</section>

		<section class="panel">
			<h3>カード請求予定</h3>
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th>請求日</th>
							<th>カード</th>
							<th class="right">件数</th>
							<th class="right">合計</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="row in payments" :key="`${row.scheduled_payment_date}-${row.credit_card_id}`">
							<td>{{ row.scheduled_payment_date }}</td>
							<td>{{ row.credit_card_name }}</td>
							<td class="right">{{ row.item_count }}</td>
							<td class="right">{{ formatYen(row.total_amount) }}</td>
						</tr>
						<tr v-if="payments.length === 0">
							<td colspan="4" class="empty">この月の請求予定はありません</td>
						</tr>
					</tbody>
				</table>
			</div>
		</section>

		<section v-if="message" class="message" :class="messageType">
			{{ message }}
		</section>
		<section v-if="loading" class="loading">読み込み中...</section>
	</div>
</template>

<style scoped lang="scss">
.household-page {
	padding: 20px;
	display: grid;
	gap: 16px;
	background: linear-gradient(180deg, #f7fbff 0%, #f6f7fa 100%);
	min-height: calc(100vh - 50px);
}

.panel {
	background: #fff;
	border: 1px solid #e5e7eb;
	border-radius: 16px;
	padding: 16px;
	box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
}

.panel h3,
.panel h2 {
	margin: 0 0 12px;
	color: #111827;
}

.panel-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
}

.summary {
	margin: 0;
	display: flex;
	gap: 12px;
	color: #374151;
}

.summary strong {
	color: #0f172a;
}

.inline-form,
.expense-form,
.card-item {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
	gap: 10px;
}

.card-list {
	display: grid;
	gap: 10px;
}

input,
select {
	height: 38px;
	border-radius: 10px;
	border: 1px solid #d1d5db;
	padding: 0 10px;
	font-size: 14px;
}

.btn {
	height: 38px;
	border: none;
	border-radius: 10px;
	background: #e5e7eb;
	color: #1f2937;
	font-weight: 700;
	cursor: pointer;
}

.btn.primary {
	background: #1d4ed8;
	color: #fff;
}

.btn.danger {
	background: #ef4444;
	color: #fff;
}

.btn:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.table-wrap {
	overflow-x: auto;
}

table {
	width: 100%;
	border-collapse: collapse;
	font-size: 14px;
}

th,
td {
	padding: 10px 8px;
	border-bottom: 1px solid #e5e7eb;
	text-align: left;
	white-space: nowrap;
}

.right {
	text-align: right;
}

.empty {
	color: #6b7280;
	text-align: center;
}

.message {
	padding: 10px 14px;
	border-radius: 10px;
	background: #f3f4f6;
	color: #1f2937;
}

.message.success {
	background: #e7f7ee;
	color: #0f5132;
}

.message.error {
	background: #fdecea;
	color: #7a271a;
}

.loading {
	color: #4b5563;
}

@media (max-width: 640px) {
	.household-page {
		padding: 14px;
	}

	.summary {
		flex-wrap: wrap;
	}
}
</style>
