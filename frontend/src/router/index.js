import { createRouter, createWebHistory } from 'vue-router';

//レイアウトをインポート
import TemplateLayout from '../layouts/template.vue';

//エラー
import NotFountError from '../views/errors/NotFoundError.vue';

const routes = [
	{
		path: '/',
		component: TemplateLayout,
		children: [
			{
				path: '',
				name: 'top',
				component: () => import('../views/template/Index.vue'),
				meta: { requiresAuth: true }
			},
		]
	},
	{
		// 404エラー
		path: '/:catchAll(.*)',
		name: 'NotFoundError',
		component: NotFountError,
	},
];

const router = createRouter(/**@type {import('vue-router').RouterOptions}*/({
	history: createWebHistory(),
	routes,
}));

// ナビゲーションガード
router.beforeEach((to, from, next) => {

	//ログイン認証機能
	// const authStore = useAuthStore();
	// const attendanceAuthStore = useAttendanceAuthStore();
	// const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
	// const requiresAttendanceAuth = to.matched.some(record => record.meta.requiresAttendanceAuth);

	// if (requiresAuth && !authStore.isAuthenticated()) {
	// 	// 管理者認証が必要なルートで未認証の場合、ログインページへリダイレクト
	// 	next({ name: 'login' });
	// } else if (requiresAttendanceAuth && !attendanceAuthStore.isAuthenticated()) {
	// 	// 従業員認証が必要なルートで未認証の場合、出勤管理ログインページへリダイレクト
	// 	next({ name: 'attendanceLogin' });
	// } else if ((to.name === 'login' && authStore.isAuthenticated()) ||
	// 	(to.name === 'attendanceLogin' && attendanceAuthStore.isAuthenticated())) {
	// 	// 既に認証済みの場合、ログインページにアクセスできないようにする
	// 	next({ name: to.name === 'login' ? 'top' : 'attendanceHome' });
	// } else {
	// 	// それ以外は通常通り遷移
	// 	next();
	// }

	next();
});

export default router;
