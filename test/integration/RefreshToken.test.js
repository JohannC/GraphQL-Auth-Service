const AppTester = require('../utils/AppTester');

let appTester;
let request;
let authTokenExpiryTime = 15 * 1000;
let refreshTokenExpiryTime = 20 * 1000

let user1 = {
    username: "username",
    email: "test@test.com",
    password: "password",
    firstName: "firstname",
    lastName: "lastname",
    age: 23,
    gender: "Mrs",
    receiveNewsletter: true
};

let user2 = {
    username: "username2",
    email: "test2@test.com",
    password: "password2",
    firstName: "firstname2",
    lastName: "lastname2",
    age: 23,
    gender: "Mrs",
    receiveNewsletter: true
};

let user3 = {
    username: "username3",
    email: "test3@test.com",
    password: "password3",
    firstName: "firstname3",
    lastName: "lastname3",
    age: 23,
    gender: "Mrs",
    receiveNewsletter: true
};

buildRefreshTokenQuery = () => {
    return {
        query: `mutation{
            refreshToken{
                expiryDate
                token
            }
        }`
    }
}

wait = (time) => new Promise((resolve) => setTimeout(resolve, time));


beforeAll((done) => {
    appTester = new AppTester({
        dbConfig: {
            userDB: "RefreshToken"
        },
        onReady: async () => {
            try {
                request = appTester.getRequestSender();
                await appTester.register(user1);
                await appTester.register(user2);
                await appTester.register(user3);
                done();
            } catch (err) {
                done(err);
            }
        },
        refreshTokenExpiryTime,
        authTokenExpiryTime
    });
}, 40000);

test("Refresh auth token", async (done) => {
    const upLimit = new Date();
    upLimit.setTime(upLimit.getTime() + authTokenExpiryTime);
    let resLogin = await appTester.login(user1.email, user1.password);
    let token1 = resLogin.data.login.token;
    expect(new Date(resLogin.data.login.expiryDate) >= upLimit).toBeTruthy();
    const UserModel = require('../../lib/model/UserModel');
    const { refreshToken } = await UserModel.getUser({ username: user1.username });
    await wait(authTokenExpiryTime)
    let resRefresh = await request.postGraphQL(buildRefreshTokenQuery(), token1,refreshToken);
    expect(new Date(resRefresh.data.refreshToken.expiryDate) > new Date(resLogin.data.login.expiryDate)).toBeTruthy();
    expect(resRefresh.data.refreshToken.token === resLogin.data.login.token).toBeFalsy();
    done();
}, 20000);

test("Refresh token expired - relog-in", async (done) => {
    const upLimit = new Date();
    upLimit.setTime(upLimit.getTime() + authTokenExpiryTime);
    let resLogin = await appTester.login(user2.email, user2.password);
    let token1 = resLogin.data.login.token;
    expect(new Date(resLogin.data.login.expiryDate) >= upLimit).toBeTruthy();
    const UserModel = require('../../lib/model/UserModel');
    const { refreshToken } = await UserModel.getUser({ username: user2.username });
    await wait(refreshTokenExpiryTime)
    let resRefresh = await request.postGraphQL(buildRefreshTokenQuery(), token1,refreshToken);
    expect(resRefresh.errors[0].message).toBe("Please login!");
    done();
}, 40000);

test("Can't refresh auth token without refresh token", async (done) => {
    const upLimit = new Date();
    upLimit.setTime(upLimit.getTime() + authTokenExpiryTime);
    let resLogin = await appTester.login(user2.email, user2.password);
    let token1 = resLogin.data.login.token;
    expect(new Date(resLogin.data.login.expiryDate) >= upLimit).toBeTruthy();
    let resRefresh = await request.postGraphQL(buildRefreshTokenQuery(), token1);
    expect(resRefresh.errors[0].message).toBe("Please login!");
    done();
}, 40000);

test("Can't update user without refresh token", async (done) => {
    let resLogin = await appTester.login(user3.email, user3.password);
    let token3 = resLogin.data.login.token;
    const query = {
        query: `mutation{
            updateMe(fields:{age: ${35}, gender: M,}){
              notifications{
                type
                message
              }
            }
          }`
    }
    let resUpdate = await request.postGraphQL(query, token3);
    expect(resUpdate.errors[0].message.includes("Unauthorized access!")).toBeTruthy();
    done();
});

test("Can't update user with expired auth token", async (done) => {
    let resLogin = await appTester.login(user3.email, user3.password);
    let token3 = resLogin.data.login.token;
    const query = {
        query: `mutation{
            updateMe(fields:{age: ${35}, gender: M,}){
              notifications{
                type
                message
              }
            }
          }`
    }
    const UserModel = require('../../lib/model/UserModel');
    const { refreshToken } = await UserModel.getUser({ username: user2.username });
    await wait(authTokenExpiryTime)
    let resUpdate = await request.postGraphQL(query, token3, refreshToken);
    expect(resUpdate.errors[0].message.includes("Please login!")).toBeTruthy();
    done();
}, 40000);

// test("Can't update user with auth token expired", async (done) => {
//     let res = await request.getGraphQL(buildEmailAvailableQuery("available.email@mail.com"));
//     expect(res.data.emailAvailable.isAvailable).toBeTruthy();
//     res = await request.getGraphQL(buildEmailAvailableQuery(user1.email));
//     expect(res.data.emailAvailable.isAvailable).toBeFalsy();
//     res = await request.getGraphQL(buildEmailAvailableQuery(user2.email));
//     expect(res.data.emailAvailable.isAvailable).toBeFalsy();
//     done();
// });

afterAll(async (done) => {
    await appTester.close(done);
}, 40000);