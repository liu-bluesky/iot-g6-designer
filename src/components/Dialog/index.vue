<template>
	<el-dialog
		ref="dialogRef"
		v-bind="$attrs"
		:fullscreen="fullscreen"
		destroy-on-close
		:append-to-body="true"
		:lock-scroll="false"
		:close-on-click-modal="false"
		:width="width"
		top="10vh"
	>
		<template #header>
			<slot name="title">
				{{ title }}
			</slot>
		</template>

		<!-- 弹窗内容 -->
		<el-scrollbar
			:class="
				fullscreen && $slots.footer
					? 'com-dialog__content--footer'
					: fullscreen && !$slots.footer
					? 'com-dialog__content--fullscreen'
					: 'com-dialog__content'
			"
		>
			<div class="content__wrap">
				<slot />
			</div>
		</el-scrollbar>
		<template v-if="$slots.footer" #footer>
			<slot name="footer" />
		</template>
	</el-dialog>
</template>

<script setup lang="tsx">
import {ref,reactive, onMounted, PropType } from 'vue';
/*
基本数据类型
引用数据类型（复杂类型） 个人建议 ref初始化变量 
ref 和 reactive 本质我们可以简单的理解为ref是对reactive的二次包装, 
ref定义的数据访问的时候要多一个.value
*/

 const state = reactive({
 })

 const props:any = defineProps({
 title: {
			type: String as PropType<string>,
			default: ""
		},
		// 是否显示全屏按钮
		showFullscreen: {
			type: Boolean as PropType<boolean>,
			default: false
		},
		width: {
			type: [String, Number],
			default: "850px"
		}
})
		const dialogRef = ref<HTMLElement | null>(null);
		const fullscreen = ref<boolean>(false);
</script>

<style lang="scss" scoped>
.dialog__icon {
	position: absolute;
	top: 22px;
	right: 45px;
	color: #909399;
	font-size: 12px;
	color: #909399;
	cursor: pointer;
	transition: color 0.2s;
	&:hover {
	}
}
.com-dialog__content {
	.content__wrap {
		padding-right: 10px;
		    overflow: hidden;
	}
	:deep(.el-scrollbar__wrap) {
		padding-bottom: 13px;
		max-height: 600px; // 最大高度
		overflow-x: hidden; // 隐藏横向滚动栏
	}
	:deep(.el-scrollbar__view) {
		height: 100%;
	}
}
.com-dialog__content--fullscreen {
	:deep(.el-scrollbar__wrap) {
		//height: calc(~"100vh - 46px - 60px"); // 最大高度
	}
}
.com-dialog__content--footer {
	:deep(.el-scrollbar__wrap) {
		//max-height: calc(~"100vh - 46px - 60px - 66px"); // 最大高度
	}
}
</style>
