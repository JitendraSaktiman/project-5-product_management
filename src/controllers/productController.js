const aws = require('aws-sdk')
const { AppConfig } = require('aws-sdk');
const validator = require("../middleware/validation")
const mongoose = require('mongoose')
const productModel = require('../models/productModel')

const isValidObjectId = function(objectId) {
    return mongoose.Types.ObjectId.isValid(objectId)
}



//==============================================-: CREATE PRODUCT:-================================================================


aws.config.update({
    accessKeyId: "AKIAY3L35MCRUJ6WPO6J",
    secretAccessKey: "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",
    region: "ap-south-1"
})

let uploadFile = async(file) => {
    return new Promise(function(resolve, reject) {
        // this function will upload file to aws and return the link
        let s3 = new aws.S3({ apiVersion: '2006-03-01' }); // we will be using the s3 service of aws

        var uploadParams = {
            ACL: "public-read", //public access
            Bucket: "classroom-training-bucket", //HERE
            Key: "abc/" + file.originalname, //HERE 
            Body: file.buffer
        }


        s3.upload(uploadParams, function(err, body) {
            if (err) {
                console.log(err)
                return reject({ "error": err })
            }
            console.log(body)
            console.log("file uploaded succesfully")
            return resolve(body.Location)
        })

    })
}


const createProduct = async function(req, res) {
    try {

        let reqBody = req.body
            //req body check
        if (Object.keys(reqBody).length === 0) {
            return res.status(400).send({ Status: false, message: " Sorry Body can't be empty" })
        }
        //destracture
        const { title, description, price, currencyId, currencyFormat, isFreeShipping, productImage, style, availableSizes, installments } = reqBody

        //validation start
        if (!validator.isValid(title)) {
            return res.status(400).send({ status: false, msg: "title is required" })
        }
        //uniqe valid...
        let checkTitle = await productModel.findOne({ title: title })
        if (checkTitle) {
            return res.status(400).send({ status: false, msg: "title already exist" })
        }
        if (!validator.isValid(description)) {
            return res.status(400).send({ status: false, msg: "description is required" })
        }

        if (!validator.isValid(price)) {
            return res.status(400).send({ status: false, msg: "price is required" })
        }
        //price must be >=0
        if (price <= 0) {
            return res.status(400).send({ status: false, message: `Price should be a valid number` })
        }
        if (!validator.isValid(currencyId)) {
            return res.status(400).send({ status: false, msg: "currencyId is required" })
        }
        //currency must be 'INR'
        if (currencyId !== 'INR') return res.status(400).send({ status: false, msg: "currencyId should be 'INR'" })

        if (!validator.isValid(currencyFormat)) {
            return res.status(400).send({ status: false, msg: "currencyFormat is required" })
        }
        //geting the file 
        let files = req.files

        if (files && files.length > 0) {
            //upload filse in aws s3
            var updateImage = await uploadFile(files[0]);
            console.log(updateImage)
        } else {
            return res.status(400).send({ msg: "No file found" })
        }
        //for valid enum
        if (availableSizes) {
            let array = availableSizes.split(",").map(x => x.trim())
            console.log(array)
            for (let i = 0; i < array.length; i++) {
                if (!(["S", "XS", "M", "X", "L", "XXL", "XL"].includes(array[i]))) {
                    return res.status(400).send({ status: false, message: `Available Sizes must be among ${["S", "XS", "M", "X", "L", "XXL", "XL"]}` })
                }
            }
        }

        if (!validator.validInstallment(installments)) {
            return res.status(400).send({ status: false, msg: "installments can't be a decimal number & must be greater than equalto zero " })
        }

        //save all key data
        let filterBody = { title, description, price, currencyId, currencyFormat, isFreeShipping, productImage, style, availableSizes, installments }
        filterBody.productImage = updateImage
        console.log(updateImage)
            //successfully created product
        let productCreated = await productModel.create(filterBody)
        res.status(201).send({ status: true, data: productCreated })
    } catch (err) {
        return res.status(500).send({ status: false, msg: err.message })
    }
}

//===============================  Get Poduct By Id  ============================

const getProduct = async function(req, res) {
    try {
        //userid from path=======
        const product_id = req.params.productId;

        //id validation====

        if (!isValidObjectId(product_id)) {
            return res.status(400).send({ status: false, message: `This ${product_id} is invalid productId` });
        }


        const product = await productModel.findOne({ _id: product_id, isDeleted: false })
            // product not found===
        if (!product) {
            return res.status(404).send({ status: false, message: "Product not found" });
        }
        //return product in response==
        return res.status(200).send({ status: true, data: product });


    } catch (error) {
        res.status(500).send({ status: false, msg: error.message })
    }

}

//=============================================================================================================

const productByQuery = async function(req, res) {
    try {
        // from Query to QuryParams
        const { size, name, price } = req.query
        console.log(req.query)
            // Existence of product=====
        queryParams = {};
        if ("size" in req.query) {

            let array = size.split(",").map(x => x.trim())

            for (let i = 0; i < array.length; i++) {
                if (!(["S", "XS", "M", "X", "L", "XXL", "XL"].includes(array[i]))) {
                    return res.status(400).send({ status: false, message: `Available Sizes must be among ${["S", "XS", "M", "X", "L", "XXL", "XL"]}` })
                }
            }

            queryParams["availableSizes"] = {$regex:size}
        }
        if ("name" in req.query) {

            if (!validator.isValid(name)) {
                return res.status(400).send({ status: false, message: "name is required" })
            }
            queryParams["title"] ={$regex: name}


        }
        if ("price" in req.query) {
            if (price <= 0) {
                return res.status(400).send({ status: false, message: `Price should be a valid number` })
            }
            queryParams["price"] = price
        }

        let productExist = await productModel.find({ queryParams, isDeleted: false })
        if (productExist.length == 0) {
            return res.status(404).send({ status: false, message: "there is no product" })
        }
        // sort by price in product collection.==========
        const products = await productModel.find({ $and: [queryParams, { isDeleted: false }] }).sort({ price: 1 })
        res.status(200).send({ status: true, data: products });


    } catch (error) {
        res.status(500).send({ status: false, msg: error.message })
    }

}

// ==============================================================================================================
const updateProduct = async function(req, res) {
    try {

        let product_id = req.params.productId

        //id format validation
        if (!isValidObjectId(product_id)) {
            return res.status(400).send({ status: false, message: "Invalid productId" });
        }

        // //fetch product using productId
        const product = await productModel.findOne({ $and: [{ _id: product_id }, { isDeleted: false }], });
        if (!product) {
            return res.status(404).send({ status: true, data: "product not found" });
        }

        //reading updates
        let updates = req.body
        req.files
        console.log(req.files)
        if(req.files==undefined){
        if (Object.keys(updates).length ===0) {
            return res.send({ status: false, message: "Body can't be empty" })
        }
    }
        let upData = {};
        const { title, description, price, currencyId, currencyFormat, isFreeShipping, productImage, style, availableSizes, installments } = updates

        if ("title" in updates) {
            if (!validator.isValid(title)) {
                return res.status(400).send({ status: false, msg: "title is required" })
            }
            upData["title"] = title

            //check uniqueness of product title
            const uniqueTitle = await productModel.findOne({ title: title });

            if (uniqueTitle) {
                return res.status(400).send({ status: false, message: `${title} already exist` });
            }

        }

        if ("description" in updates) {
            if (!validator.isValid(description)) {
                return res.status(400).send({ status: false, msg: "description is required" })
            }
            upData["description"] = description
        }

        if ("price" in updates) {
            if (!validator.isValid(price)) {
                return res.status(400).send({ status: false, msg: "price is required" })
            }
            upData["price"] = price
        }

        if ("currencyId" in updates) {
            if (!validator.isValid(currencyId)) {
                return res.status(400).send({ status: false, msg: "currencyId is required" })
            }
            upData["currencyId"] = currencyId
        }
        upData["currencyId"] = currencyId
        if ("currencyFormat" in updates) {
            if (!validator.isValid(currencyFormat)) {
                return res.status(400).send({ status: false, msg: "currencyFormat is required" })
            }
            upData["currencyFormat"] = currencyFormat
        }

        if ("isFreeShipping" in updates) {
            if (!validator.isValid(isFreeShipping)) {
                return res.status(400).send({ status: false, msg: "isFreeShipping is required" })
            }
            upData["isFreeShipping"] = isFreeShipping
        }


        // upData["productImage"] = productImage
        if ("style" in updates) {
            if (!validator.isValid(style)) {
                return res.status(400).send({ status: false, msg: "style is required" })
            }
            upData["style"] = style
        }

        if ("availableSizes" in updates) {

            let array = availableSizes.split(",").map(x => x.trim())
            console.log(array)
            for (let i = 0; i < array.length; i++) {
                if (!(["S", "XS", "M", "X", "L", "XXL", "XL"].includes(array[i]))) {
                    return res.status(400).send({ status: false, message: `Available Sizes must be among ${["S", "XS", "M", "X", "L", "XXL", "XL"]}` })
                }
            }
            upData["availableSizes"] = availableSizes
        }

        if ("installments" in updates) {
            if (!validator.isValid(installments)) {
                return res.status(400).send({ status: false, msg: "installments is required" })
            }
            upData["installments"] = installments
        }



        let files = req.files 
        if(Object.keys(req.body).length===0){
        if (req.files.length == 0 && req.files != undefined) {
            return res.status(400).send({ status: false, msg: "Please select file" })
        }
    } 
        if (req.files.length > 0) {
            if (files && files.length > 0) {

                var updateImage = await uploadFile(files[0])
            } else {
                return res.status(400).send({ msg: "No files found" })
            }

            updates.productImage = updateImage
        }


        let productUpdated = await productModel.findOneAndUpdate({ _id: product_id, isDeleted: false }, { $set: updates }, { new: true })
        res.status(200).send({ status: true, message: "Product updated", date: productUpdated })



    } catch (error) {
        res.status(500).send({ status: false, msg: error.message })
    }
}


const deleteProduct = async function(req, res) {
    try {
        let id = req.params.productId

        //id format validation
        if (!isValidObjectId(id)) {
            return res.status(400).send({ status: false, message: "Invalid productId" });
        }

        //check if the document is found with that Product id and check if it already deleted or not
        let verification = await productModel.findById(id)
        if (!verification) {
            return res.status(404).send({ Status: false, msg: "Document Not Found" })
        }
        if (verification.isDeleted === true) {
            return res.status(400).send({ Status: false, msg: "Document already deleted" })
        }
        //secussfully deleted Product data
        else {
            let FinalResult = await productModel.findByIdAndUpdate({ _id: id }, { isDeleted: true, deletedAt: new Date() }, { new: true })
            return res.status(200).send({ Status: true, message: " Successfully deleted the Product " })
        }
    } catch (err) {
        return res.status(500).send({ Status: false, msg: "Error", error: err.message })
    }
}

module.exports = { updateProduct, getProduct, productByQuery, createProduct, deleteProduct }