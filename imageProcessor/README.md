Image Processor

lld link : https://drive.google.com/file/d/1Fga2t4gPOHZsorr0WnvHmpt7Bi2DqSW9/view?usp=drive_link

if running in localhost:
file upload api: ( post )
Based on the format it  is  validated first and then  uploaded
http://localhost:3000/upload

check status: ( get )
This api checks the status of a file upload whether all images are succesfully processed or not. For  this project even if single image fails then all the images against the file will be set to failed and further processing stops. This can be modified according to requirement whether to by pass the image which fails and continue for other
with this api for a file if all  the image status is success it returns success else processing if processing else failed.
http://localhost:3000/status:requestId
