const cartModel = require('../models/cartModel');
const userModel = require('../models/userModel');
const productModel = require('../models/productModel');
const aws = require("../middleware/aws")
const orderModel = require('../models/orderModel');
const validator = require('../middleware/validation')
const mongoose = require("mongoose")



const isValidObjectId = function (objectId) {
    return mongoose.Types.ObjectId.isValid(objectId)
}


const createOrder = async function (req, res) {
    try {

        body = req.body;
        userid = req.params.userId;

        if (Object.keys(body).length === 0) {
            return res.status(400).send({ status: false, msg: " sorry body can't be empty " })
        }
        const { cartId, status, cancellable } = body

        if (!isValidObjectId(cartId)) {
            return res.status(400).send({ status: false, message: "cart id must be present " });
        }

        let checkCart = await cartModel.findOne({ _id: cartId })
        if (!checkCart) {
            return res.status(404).send({ status: false, msg: "cart does not exist" })
        }
        let checkUserCart = await cartModel.findOne({ _id: cartId, userId: userid })
        if (!checkUserCart) {
            return res.status(404).send({ status: false, msg: "cart does not belong to that user" })
        }

        if (cancellable) {
            if (typeof cancellable != "boolean") {
                return res.status(400).send({ status: false, message: 'Cancellable must be boolean' });
            }
        }

        if (status) {
            if (!validator.isValidStatus(status)) {
                return res.status(400).send({ status: false, message: `Status must be among ['pending','completed','cancelled'].` });
            }
        }
        if (checkUserCart.items.length == 0) {
            return res.status(202).send({ status: false, message: "cart have no items" });
        }
        if (checkUserCart.items.length > 0) {
            
            let quantityValue=0;
            for(let i= 0;i<checkUserCart.items.length;i++){
                quantityValue+=checkUserCart.items[i].quantity 
                body.totalQuantity = quantityValue
            }
        }

        body.totalItems = checkUserCart.totalItems
        body.items = checkUserCart.items
        body.totalPrice = checkUserCart.totalPrice
        body.userId=req.params.userId
         
        

        
        let createOrder = await orderModel.create(body)

        let findCreatedOrder = await orderModel.findById({ _id: createOrder._id }).select({ "__v": 0 })

        return res.status(201).send({ status: true, message: "Success", data: findCreatedOrder })

    }
    catch (err) {
        return res.status(500).send({ Status: false, message: err.message })
    }
}
 
//============================================================ update ==================================================
 
const updateOrder= async function(req,res){
    try{

        let body=req.body

        let {status,orderId}=body

        if(Object.keys(body).length === 0 ){
            return res.status(400).send({Status: false , message: "Please provide data"})   
        }

        if(!valitador.isValid(orderId)  ){
            return res.status(400).send({Status: false , message: "Please provide orderId"})
        }
        if(!isValidObjectId(orderId)){
            return res.status(400).send({Status: false , message: "Please provide valid orderId"})  
        }

        let checkUser= await orderModel.findOne({userId:req.params.userId,isDeleted:false})
        if(!checkUser){
            return res.status(404).send({Status: false , message: "user has not created any order"})   
        }
        let checkOrder = await orderModel.findOne({_id:orderId,isDeleted:false})
        if(!checkOrder){
            return res.status(404).send({Status: false , message: "no order found with given orderId"})   
        }

        if(checkOrder.userId != req.params.userId){
            return res.status(400).send({Status: false , message: "This user does not exist this order"}) 
        }

        if(checkOrder.status === "cancelled"){
            return res.status(400).send({Status: false , message: "Your order has been cancelled"})  
        }

        if(checkOrder.cancellable == true){
            let updateOrderDetail= await orderModel.findOneAndUpdate({_id:orderId,isDeleted:false},{status:"cancelled",isDeleted:true,deletedAt: Date.now()},{new:true}).select({ "__v": 0})

            if(!updateOrderDetail){
                return res.status(400).send({Status: false , message: "Sorry it can not be cancelled"})   
            }

            return res.status(200).send({ status: true, message: "Success", data: updateOrderDetail })
        }

      
        if (!status) {
            if (!validator.isValid(status)) {
                return res.status(400).send({ status: false, message: "provide status in request body" })
            }
        }

        if (status == "pending") {
            return res.status(400).send({ status: false, message: "status can not be pending" })
        }
        if (status == "cancled") {
            if (orderPresent.cancellable === false) {
                return res.status(400).send({ status: false, message: "order Can not be cancelled" })
            }
        }


        let orderStatus = await orderModel.findOneAndUpdate({ _id: orderId }, { $set: requestBody }, { new: true })
        let cartUpdate = await cartModel.findOneAndUpdate({ userId: userId }, { $set: { items: [], totalPrice: 0, totalItems: 0 } }, { new: true })
        res.status(200).send({ status: true,message:"Success" ,data: orderStatus })
    }

    catch (err) {
        return res.status(500).send({ status: false, msg: err.message })
    }
}

module.exports = {createOrder, updateOrder}