import { replaceMongoIdInArray, replaceMongoIdInObject } from "@/lib/convertData";  
import { User } from "@/model/user-model";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/service/mongo";

export async function getUserByEmail(email){
    if (!email) return null;
    await dbConnect();
    const user = await User.findOne({email: email}).lean();
    return user ? replaceMongoIdInObject(user) : null;
} 

export async function getUserDetails(userId){
    const user = await User.findById(userId).lean();
    return replaceMongoIdInObject(user);
} 

export async function validatePassword(email, password){
    if (!email || !password) return false;
    const user = await getUserByEmail(email);
    if (!user || !user.password) return false;
    const isMatch = await bcrypt.compare(
        password,
        user.password
    );
    return isMatch
}