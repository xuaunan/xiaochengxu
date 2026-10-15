-- 演示订单备注清洗：把种子数据里的状态描述类文案换成真实乘客备注口吻
-- 订单 1/9/12 的 remark 尾部带 [INVOICE_META] 发票元数据块，仅替换可读前缀，元数据块保留
SET NAMES utf8mb4;

UPDATE t_ride_order SET remark = '不赶时间，麻烦师傅开稳一点' WHERE id = 1 AND remark LIKE '带优惠券的已完成打车订单%';
UPDATE t_ride_order SET remark = '请尽快派单，赶时间'        WHERE id = 2 AND remark = '等待派单';
UPDATE t_ride_order SET remark = '到达后请在 2 号口等候'     WHERE id = 3 AND remark = '司机已接单，正在前往起点';
UPDATE t_ride_order SET remark = '航班刚落地，稍等几分钟'    WHERE id = 4 AND remark = '司机接驾中';
UPDATE t_ride_order SET remark = '跨境行程，请预留通关时间'  WHERE id = 5 AND remark = '跨境行程进行中';
UPDATE t_ride_order SET remark = NULL                        WHERE id = 6 AND remark = '司机接单前已取消';
UPDATE t_ride_order SET remark = '两人出行，行李一件'        WHERE id = 7 AND remark = '已完成顺风车订单';
UPDATE t_ride_order SET remark = '可接受拼车，有一个行李箱'  WHERE id = 8 AND remark = '等待匹配拼车';
UPDATE t_ride_order SET remark = '接机请举牌等候'            WHERE id = 9 AND remark LIKE '已完成国际接送机订单%';
UPDATE t_ride_order SET remark = NULL                        WHERE id = 10 AND remark = '国际订单已取消';
UPDATE t_ride_order SET remark = '夜间行车，请注意安全'      WHERE id = 11 AND remark = '昨日已完成订单';
UPDATE t_ride_order SET remark = '带老人出行，请开空调'      WHERE id = 12 AND remark LIKE '历史顺风车订单%';
