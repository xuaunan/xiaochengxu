import { createRouter, createWebHashHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import ImportantMessagesView from '../views/ImportantMessagesView.vue'
import UserView from '../views/UserView.vue'
import DriverView from '../views/DriverView.vue'
import OrderView from '../views/OrderView.vue'
import CouponView from '../views/CouponView.vue'
import MemberView from '../views/MemberView.vue'
import SupportView from '../views/SupportView.vue'
import InternationalView from '../views/InternationalView.vue'
import SystemView from '../views/SystemView.vue'

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    component: DashboardView,
    meta: {
      title: '运营数据大盘',
      group: '首页'
    }
  },
  {
    path: '/messages',
    component: ImportantMessagesView,
    meta: {
      title: '重要消息',
      group: '运营管理'
    }
  },
  {
    path: '/users',
    component: UserView,
    meta: {
      title: '用户管理',
      group: '运营管理'
    }
  },
  {
    path: '/drivers',
    component: DriverView,
    meta: {
      title: '司机管理',
      group: '运营管理'
    }
  },
  {
    path: '/orders',
    component: OrderView,
    meta: {
      title: '订单管理',
      group: '运营管理'
    }
  },
  {
    path: '/coupons',
    component: CouponView,
    meta: {
      title: '营销中心',
      group: '营销管理'
    }
  },
  {
    path: '/members',
    component: MemberView,
    meta: {
      title: '会员管理',
      group: '营销管理'
    }
  },
  {
    path: '/support',
    component: SupportView,
    meta: {
      title: '客服服务',
      group: '运营管理'
    }
  },
  {
    path: '/international',
    component: InternationalView,
    meta: {
      title: '国际出行',
      group: '运营管理'
    }
  },
  {
    path: '/system',
    component: SystemView,
    meta: {
      title: '系统配置',
      group: '系统管理'
    }
  }
]

export default createRouter({
  history: createWebHashHistory(),
  routes
})
